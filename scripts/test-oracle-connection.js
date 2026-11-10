const oracledb = require('oracledb');
const net = require('net');
const dns = require('dns');
const { promisify } = require('util');
const ping = require('ping');

const lookup = promisify(dns.lookup);

async function testTcpConnection(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let success = false;

    socket.setTimeout(5000);  // 5 second timeout

    socket.on('connect', () => {
      success = true;
      socket.end();
      resolve({ success: true, message: 'TCP connection successful' });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, message: 'TCP connection timeout' });
    });

    socket.on('error', (error) => {
      resolve({ success: false, message: `TCP connection error: ${error.message}` });
    });

    socket.connect(port, host);
  });
}

async function testOracleConnection() {
  const host = '192.168.11.118';
  const port = 1521;
  const service = 'newcrm';

  console.log('Starting Oracle connection diagnostics...\n');

  // 1. DNS Resolution
  try {
    console.log(`Testing DNS resolution for ${host}...`);
    const address = await lookup(host);
    console.log(`✓ DNS Resolution successful: ${address.address}\n`);
  } catch (err) {
    console.log(`✗ DNS Resolution failed: ${err.message}\n`);
    return;
  }

  // 2. ICMP Ping
  try {
    console.log(`Pinging ${host}...`);
    const res = await ping.promise.probe(host, {
      timeout: 5,
      extra: ['-n', '1'],
    });
    if (res.alive) {
      console.log(`✓ Ping successful (${res.time}ms)\n`);
    } else {
      console.log(`✗ Ping failed\n`);
    }
  } catch (err) {
    console.log(`✗ Ping error: ${err.message}\n`);
  }

  // 3. TCP Connection
  console.log(`Testing TCP connection to ${host}:${port}...`);
  const tcpResult = await testTcpConnection(host, port);
  if (tcpResult.success) {
    console.log(`✓ ${tcpResult.message}\n`);
  } else {
    console.log(`✗ ${tcpResult.message}\n`);
    return;
  }

  // 4. Oracle Connection
  try {
    console.log('Initializing Oracle client...');
    try {
      await oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_PATH || 'C:\\oracle\\instantclient_19_26' });
      console.log('✓ Oracle Client initialized\n');
    } catch (err) {
      if (!err.message.includes('NJS-076') && !err.message.includes('already initialized')) {
        throw err;
      }
    }

    console.log('Testing Oracle connection...');
    const connection = await oracledb.getConnection({
      user: 'hcs_fin',
      password: 'hcs_fin',
      connectString: `${host}:${port}/${service}`,
      connectTimeout: 5000
    });

    console.log('✓ Oracle connection successful');
    console.log('Testing basic query...');
    
    const result = await connection.execute('SELECT 1 FROM DUAL');
    console.log('✓ Query successful\n');

    await connection.close();
  } catch (err) {
    console.log(`✗ Oracle connection failed: ${err.message}\n`);
  }
}

testOracleConnection().catch(console.error); 