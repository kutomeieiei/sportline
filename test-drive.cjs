const https = require('https');

https.get('https://drive.google.com/uc?export=view&id=1ATCNkuyDtZeq16R6ht19lVp28qjVRORU', (res) => {
  console.log('statusCode:', res.statusCode);
  console.log('headers:', res.headers);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
}).on('error', (e) => {
  console.error(e);
});
