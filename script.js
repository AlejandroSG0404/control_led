// Conserva el puerto, el lector y el estado de las operaciones serie.
let puerto = null;
let lector = null;
let conectado = false;
let escribiendo = false;

// Obtiene los elementos de la interfaz que se actualizarán desde JavaScript.
const estadoConexion = document.getElementById("estadoConexion");
const btnConectar = document.getElementById("btnConectar");
const bombilla = document.getElementById("bombilla");
const estadoLed = document.getElementById("estadoLed");
const btnEncender = document.getElementById("btnEncender");
const btnApagar = document.getElementById("btnApagar");
const mensaje = document.getElementById("mensaje");

// Solicita acceso al puerto serie, lo abre a 9600 baudios y arranca la lectura.
async function conectar() {
  if (!("serial" in navigator)) {
    alert("Utiliza Google Chrome o Microsoft Edge");
    return;
  }

  try {
    puerto = await navigator.serial.requestPort();
    await puerto.open({ baudRate: 9600 });

    conectado = true;
    estadoConexion.textContent = "Arduino conectado";
    btnConectar.disabled = true;
    btnEncender.disabled = false;
    btnApagar.disabled = false;
    mensaje.textContent = "Conexión establecida. Puedes controlar el LED.";

    const decodificador = new TextDecoderStream();
    const entradaCerrada = puerto.readable.pipeTo(decodificador.writable);
    lector = decodificador.readable.getReader();
    leerArduino(entradaCerrada);
  } catch (error) {
    conectado = false;
    estadoConexion.textContent = "Arduino desconectado";
    btnConectar.disabled = false;
    btnEncender.disabled = true;
    btnApagar.disabled = true;
    mensaje.textContent = `No se pudo conectar con Arduino: ${error.message}`;
  }
}

// Lee continuamente las respuestas serie y procesa las líneas completas.
async function leerArduino(entradaCerrada) {
  let textoPendiente = "";

  try {
    while (conectado && lector) {
      const { value, done } = await lector.read();
      if (done) {
        break;
      }

      textoPendiente += value;
      const lineas = textoPendiente.split("\n");
      textoPendiente = lineas.pop() ?? "";

      for (const linea of lineas) {
        const respuesta = linea.trim();
        if (respuesta === "ENCENDIDO") {
          mostrarEstado(true);
        } else if (respuesta === "APAGADO") {
          mostrarEstado(false);
        }
      }
    }

    await entradaCerrada;
  } catch (error) {
    if (conectado) {
      mensaje.textContent = `Error al leer del puerto serie: ${error.message}`;
    }
  } finally {
    if (lector) {
      lector.releaseLock();
      lector = null;
    }
    conectado = false;
    btnEncender.disabled = true;
    btnApagar.disabled = true;
    btnConectar.disabled = false;
    estadoConexion.textContent = "Arduino desconectado";
  }
}

// Envía una orden terminada en salto de línea y evita escrituras simultáneas.
async function enviarOrden(orden) {
  if (!conectado || !puerto || escribiendo) {
    return;
  }

  escribiendo = true;
  let escritor = null;

  try {
    escritor = puerto.writable.getWriter();
    await escritor.write(new TextEncoder().encode(`${orden}\n`));
  } catch (error) {
    mensaje.textContent = `No se pudo enviar la orden: ${error.message}`;
  } finally {
    if (escritor) {
      escritor.releaseLock();
    }
    escribiendo = false;
  }
}

// Actualiza el indicador visual y el mensaje de confirmación del LED.
function mostrarEstado(encendido) {
  const estado = encendido ? "encendido" : "apagado";
  estadoLed.textContent = `LED ${estado.toUpperCase()}`;
  estadoLed.classList.toggle("encendido", encendido);
  estadoLed.classList.toggle("apagado", !encendido);
  bombilla.classList.toggle("encendido", encendido);
  bombilla.classList.toggle("apagado", !encendido);
  mensaje.textContent = `Arduino ha ${encendido ? "encendido" : "apagado"} el LED`;
}

// Asocia los botones a las órdenes que entiende el programa del Arduino.
btnConectar.addEventListener("click", conectar);
btnEncender.addEventListener("click", () => enviarOrden("ON"));
btnApagar.addEventListener("click", () => enviarOrden("OFF"));
