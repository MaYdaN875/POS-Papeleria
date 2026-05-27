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
  fs.appendFileSync(file, text + '\n\n');
}

async function fetchAPI(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const body = new URLSearchParams(data).toString();

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseBody));
        } catch (e) {
          resolve(responseBody);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runTest(test, isService = false) {
  console.log(`Ejecutando prueba: ${test.carrier} - ${test.codigo} - ${test.referencia}`);
  
  const payload = {
    key: KEY,
    nip: NIP,
    producto: test.codigo,
    referencia: test.referencia
  };

  if (isService) {
    payload.monto = test.monto;
  }

  // Guardar Request
  appendLog(logRequestFile, `==== REQUEST a /requestTXN ====\n${JSON.stringify(payload, null, 2)}`);

  // Ejecutar Petición
  const response = await fetchAPI('/requestTXN', payload);

  // Guardar Response
  appendLog(logRequestFile, `==== RESPONSE de /requestTXN ====\n${JSON.stringify(response, null, 2)}`);

  let finalTransId = response.data?.transID || '';
  let finalFolio = '';
  let finalStatus = '';
  let finalError = response.error || '';

  // Si está "En Proceso", hay que checar statusTXN
  if (response.success && response.message && response.message.toLowerCase().includes('proceso')) {
    let statusResponse;
    for (let i = 0; i < 10; i++) {
      console.log(`Consultando status de ${finalTransId} (Intento ${i + 1})...`);
      await sleep(5000); // Esperar 5 segs

      const statusPayload = { key: KEY, nip: NIP, transID: finalTransId };
      appendLog(logStatusFile, `==== REQUEST a /statusTXN ====\n${JSON.stringify(statusPayload, null, 2)}`);
      
      statusResponse = await fetchAPI('/statusTXN', statusPayload);
      appendLog(logStatusFile, `==== RESPONSE de /statusTXN ====\n${JSON.stringify(statusResponse, null, 2)}`);

      if (statusResponse.data && statusResponse.data.Status !== 'Procesando') {
        finalFolio = statusResponse.data.Folio || '';
        finalStatus = statusResponse.data.Status || '';
        finalError = statusResponse.error || '';
        break;
      }
    }
  } else {
    if (response.data) {
      finalFolio = response.data.Folio || '';
      finalStatus = response.data.Status || '';
    }
  }

  // Guardar en CSV
  const csvLine = `${isService ? 'Servicio' : 'Recarga'},${test.referencia},${test.carrier},${test.codigo},${test.monto},${response.message},${finalTransId},${finalFolio},${finalStatus},${finalError}\n`;
  fs.appendFileSync(resultsFile, csvLine);

  console.log(`✅ Prueba ${test.codigo} terminada.\n`);
  await sleep(1000); // Pausa entre pruebas para no saturar
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

  console.log("=== INICIANDO MATRIZ DE PRUEBAS TAECEL ===");
  
  for (const r of recargas) await runTest(r, false);
  for (const s of servicios) await runTest(s, true);

  console.log("=== PRUEBAS TERMINADAS ===");
  console.log("Revisa los archivos Log_requestTXN.txt, Log_statusTXN.txt y Resultados.csv");
}

main();
