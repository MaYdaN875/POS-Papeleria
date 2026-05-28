const fs = require('fs');
const https = require('https');

const KEY = 'I4NBwuJlqvigHszC5X8gdiDsTa9360415998355b94a36dd5a256ee069X8GIIEqNs2jWLEngXDYpdAvaJLo2pQ';
const NIP = '07328698c645cd0860372b8efa18be9aVmYC5HgwuJ';
const BASE_URL = 'https://app.taecel.com/api';

const logRequestFile = 'Log_requestTXN.txt';
const logStatusFile = 'Log_statusTXN.txt';
const resultsFile = 'Resultados.csv';

// Limpiar archivos anteriores
fs.writeFileSync(logRequestFile, '');
fs.writeFileSync(logStatusFile, '');
fs.writeFileSync(resultsFile, 'Tipo,Referencia,Carrier,Codigo,Monto,Resultado,TransID,Folio,Status,Error\n');

function appendLog(file, text) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(file, `[${timestamp}]\n${text}\n\n`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Hace POST a la API de Taecel con un timeout configurable.
 */
function fetchAPI(endpoint, data, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const body = new URLSearchParams(data).toString();

    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: timeoutMs
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(responseBody)); }
        catch (e) { resolve({ success: false, error: 'PARSE_ERROR', message: responseBody }); }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`TIMEOUT: No hubo respuesta en ${timeoutMs / 1000} segundos`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Consulta StatusTXN en un ciclo hasta obtener respuesta final (Exitosa/Fracasada)
 * o hasta agotar el tiempo máximo de 60 segundos desde el inicio de requestTXN.
 *
 * - Timeout por petición de statusTXN: 10 segundos
 * - Sleep entre intentos: 3 segundos
 * - Tiempo máximo total: 60 segundos desde que inició requestTXN
 */
async function pollStatusTXN(transID, startTime) {
  const MAX_TOTAL_MS = 60000; // 60 segundos desde requestTXN
  const STATUS_TIMEOUT_MS = 10000; // 10 segundos por petición
  const SLEEP_BETWEEN_MS = 3000; // 3 segundos entre intentos

  let attempt = 0;
  let lastResponse = null;

  while (true) {
    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_TOTAL_MS) {
      console.log(`    ⏱ Se agotaron los 60 segundos para transID ${transID}`);
      break;
    }

    attempt++;
    console.log(`    📡 StatusTXN intento #${attempt} para transID ${transID} (${Math.round(elapsed / 1000)}s transcurridos)...`);

    const statusPayload = { key: KEY, nip: NIP, transID: transID };

    // Log del REQUEST
    appendLog(logStatusFile, `==== REQUEST a /StatusTXN (Intento #${attempt}) ====\nFecha y hora: ${new Date().toISOString()}\nParametros enviados:\n${JSON.stringify(statusPayload, null, 2)}`);

    try {
      lastResponse = await fetchAPI('/StatusTXN', statusPayload, STATUS_TIMEOUT_MS);

      // Log del RESPONSE
      appendLog(logStatusFile, `==== RESPONSE de /StatusTXN (Intento #${attempt}) ====\nFecha y hora: ${new Date().toISOString()}\nRespuesta recibida:\n${JSON.stringify(lastResponse, null, 2)}`);

      // Verificar si es respuesta final
      if (lastResponse.success === true || lastResponse.success === false) {
        const status = lastResponse.data?.Status || '';
        const statusLower = status.toLowerCase();

        // Si es "Exitosa" o "Fracasada" -> DETENEMOS
        if (statusLower === 'exitosa' || statusLower === 'fracasada' || statusLower === 'fracazada') {
          console.log(`    ✅ Respuesta final obtenida: ${status}`);
          return lastResponse;
        }

        // Si dice "en proceso" -> seguimos consultando
        if (statusLower.includes('proceso') || statusLower.includes('procesando')) {
          console.log(`    ⏳ Status "En Proceso", reintentando...`);
        } else if (lastResponse.success === false) {
          // success:false con un error concreto -> es respuesta final (fracasada)
          console.log(`    ❌ Respuesta final (error): ${lastResponse.message}`);
          return lastResponse;
        } else {
          // success:true pero sin status claro -> respuesta final
          console.log(`    ✅ Respuesta obtenida: ${lastResponse.message}`);
          return lastResponse;
        }
      }
    } catch (err) {
      appendLog(logStatusFile, `==== ERROR en /StatusTXN (Intento #${attempt}) ====\nFecha y hora: ${new Date().toISOString()}\nError: ${err.message}`);
      console.log(`    ⚠ Error en StatusTXN: ${err.message}, reintentando...`);
    }

    // Verificar si con el sleep nos pasaríamos de 60s
    const elapsedAfter = Date.now() - startTime;
    if (elapsedAfter + SLEEP_BETWEEN_MS >= MAX_TOTAL_MS) {
      console.log(`    ⏱ Se agotarían los 60 segundos, deteniendo consultas.`);
      break;
    }

    await sleep(SLEEP_BETWEEN_MS);
  }

  return lastResponse;
}

/**
 * Ejecuta una prueba completa: RequestTXN -> StatusTXN (con ciclo)
 */
async function runTest(test, isService = false) {
  console.log(`\n🔄 Ejecutando prueba: ${test.carrier} - ${test.codigo} - ${test.referencia}`);

  const payload = {
    key: KEY,
    nip: NIP,
    producto: test.codigo,
    referencia: test.referencia
  };
  if (isService) {
    payload.monto = test.monto;
  }

  const startTime = Date.now(); // Inicio del cronómetro de 60s

  // ========== PASO 1: RequestTXN (timeout 30s) ==========
  appendLog(logRequestFile, `==== REQUEST a /RequestTXN ====\nFecha y hora: ${new Date().toISOString()}\nParametros enviados:\n${JSON.stringify(payload, null, 2)}`);

  let requestResponse;
  let transID = '';

  try {
    requestResponse = await fetchAPI('/RequestTXN', payload, 30000);
    appendLog(logRequestFile, `==== RESPONSE de /RequestTXN ====\nFecha y hora: ${new Date().toISOString()}\nRespuesta recibida:\n${JSON.stringify(requestResponse, null, 2)}`);

    transID = requestResponse.data?.transID || '';
    console.log(`  📨 RequestTXN respondió: ${requestResponse.message} | transID: ${transID}`);

  } catch (err) {
    // RequestTXN no respondió (timeout) -> FRACASADA
    appendLog(logRequestFile, `==== ERROR en /RequestTXN ====\nFecha y hora: ${new Date().toISOString()}\nError: ${err.message}`);
    console.log(`  ❌ RequestTXN TIMEOUT - Operación FRACASADA`);

    fs.appendFileSync(resultsFile, `${isService ? 'Servicio' : 'Recarga'},${test.referencia},${test.carrier},${test.codigo},${test.monto},TIMEOUT - Fracasada,,,,TIMEOUT\n`);
    return;
  }

  // Si no devuelve transID válido -> FRACASADA
  if (!transID) {
    console.log(`  ❌ No se recibió transID válido - Operación FRACASADA`);
    const errorCode = requestResponse.error || '';

    fs.appendFileSync(resultsFile, `${isService ? 'Servicio' : 'Recarga'},${test.referencia},${test.carrier},${test.codigo},${test.monto},${requestResponse.message || 'Sin transID'},,,Fracasada,${errorCode}\n`);
    return;
  }

  // ========== PASO 2: StatusTXN (ciclo con reintentos) ==========
  console.log(`  🔍 Iniciando consultas a StatusTXN...`);
  const statusResponse = await pollStatusTXN(transID, startTime);

  // Extraer datos finales
  let finalFolio = '';
  let finalStatus = '';
  let finalError = '';
  let finalMessage = '';

  if (statusResponse && statusResponse.data) {
    finalFolio = statusResponse.data.Folio || '';
    finalStatus = statusResponse.data.Status || '';
    finalError = statusResponse.error || '';
    finalMessage = statusResponse.message || '';
  } else {
    finalStatus = 'Sin respuesta';
    finalMessage = 'No se obtuvo respuesta final de StatusTXN';
  }

  // Guardar en CSV
  fs.appendFileSync(resultsFile, `${isService ? 'Servicio' : 'Recarga'},${test.referencia},${test.carrier},${test.codigo},${test.monto},${finalMessage},${transID},${finalFolio},${finalStatus},${finalError}\n`);

  console.log(`  ✅ Prueba ${test.codigo} terminada. Status: ${finalStatus} | Folio: ${finalFolio}`);
  await sleep(1000); // Pausa entre pruebas
}

async function main() {
  const recargas = [
    { carrier: 'Telcel', codigo: 'TEL010', monto: 10, referencia: '5555555505' },
    { carrier: 'Telcel', codigo: 'TEL050', monto: 50, referencia: '5555555510' },
    { carrier: 'Telcel', codigo: 'TEL100', monto: 100, referencia: '5555555515' },
    { carrier: 'Telcel', codigo: 'TEL150', monto: 150, referencia: '5555555520' },
    { carrier: 'Telcel', codigo: 'TEL200', monto: 200, referencia: '5555555525' },
    { carrier: 'Movistar', codigo: 'MOV010', monto: 10, referencia: '5555555530' },
    { carrier: 'Movistar', codigo: 'MOV050', monto: 50, referencia: '5555555540' },
    { carrier: 'Movistar', codigo: 'MOV100', monto: 100, referencia: '5555555560' },
    { carrier: 'Movistar', codigo: 'MOV120', monto: 120, referencia: '5555555565' },
    { carrier: 'Movistar', codigo: 'MOV150', monto: 150, referencia: '5555555200' },
  ];

  const servicios = [
    { carrier: 'SKY', codigo: 'SKY000', monto: 95, referencia: '871235412635' },
    { carrier: 'TELMEX', codigo: 'TMX001', monto: 100, referencia: '6589745213' },
    { carrier: 'CFE', codigo: 'CFE000', monto: 260, referencia: '125478965412365478965230126654' },
    { carrier: 'MEGACABLE', codigo: 'MEG000', monto: 131, referencia: '9854123547' },
    { carrier: 'DISH', codigo: 'DSH000', monto: 103, referencia: '27458965324125' },
    { carrier: 'MAXCOM', codigo: 'MAX000', monto: 177, referencia: '3456987' },
  ];

  console.log("=== INICIANDO MATRIZ DE PRUEBAS TAECEL (v2 - Con StatusTXN) ===\n");
  console.log("Lógica implementada:");
  console.log("  1. RequestTXN con timeout de 30 segundos");
  console.log("  2. StatusTXN inmediatamente después");
  console.log("  3. Ciclo de reintentos cada 3 segundos");
  console.log("  4. Máximo 60 segundos totales desde RequestTXN\n");

  for (const r of recargas) await runTest(r, false);
  for (const s of servicios) await runTest(s, true);

  console.log("\n=== PRUEBAS TERMINADAS ===");
  console.log("Archivos generados:");
  console.log(`  📄 ${logRequestFile}`);
  console.log(`  📄 ${logStatusFile}`);
  console.log(`  📄 ${resultsFile}`);
}

main();
