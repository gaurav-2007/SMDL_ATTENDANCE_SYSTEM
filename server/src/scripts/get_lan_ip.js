const os = require('os');
const ifaces = os.networkInterfaces();
for (const [name, list] of Object.entries(ifaces)) {
  for (const item of list) {
    if (item.family === 'IPv4' && !item.internal) {
      console.log(`${name}: ${item.address}`);
    }
  }
}
