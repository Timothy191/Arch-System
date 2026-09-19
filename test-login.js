const loginUrl = 'https://temporary-fleet-quasar-kae7u5a.vercel.app/api/auth/login';

async function testLogin() {
  console.log(`Testing login at ${loginUrl}...`);
  try {
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@plantcor.os',
        password: 'Yugioh@123#'
      })
    });
    
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response: ${text.substring(0, 500)}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

testLogin();
