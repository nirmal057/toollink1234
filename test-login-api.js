const response = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        email: 'admin@toollink.com',
        password: 'admin123'
    })
});

console.log('Response status:', response.status);
console.log('Response headers:', Object.fromEntries(response.headers.entries()));

const data = await response.text();
console.log('Response body:', data);

try {
    const jsonData = JSON.parse(data);
    console.log('Parsed JSON:', jsonData);
} catch (e) {
    console.log('Not valid JSON response');
}
