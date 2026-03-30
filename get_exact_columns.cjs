const https = require('https');
const fs = require('fs');

const url = 'https://efeikudymqplfamtexgq.supabase.co/rest/v1/';
const apikey = 'sb_publishable_IKq4DPh80AlDfYmElLvw4Q_xAUYE6hf';

const options = {
  headers: {
    'apikey': apikey,
    'Authorization': 'Bearer ' + apikey
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const spec = JSON.parse(data);
      const activities = spec.definitions.activities;
      if (activities) {
        console.log('--- Colunas Reais do Banco (via Spec) ---');
        console.log(Object.keys(activities.properties));
      } else {
        console.log('Tabela activities não encontrada no spec.');
      }
    } catch (e) {
      console.error('Erro ao processar JSON:', e.message);
      console.log('Resposta bruta:', data);
    }
  });
}).on('error', (err) => {
  console.error('Erro na requisição:', err.message);
});
