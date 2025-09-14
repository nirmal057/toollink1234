// Debug script to check user role in localStorage
console.log('=== Debug User Role ===');

// Check localStorage for user data
const userDataRaw = localStorage.getItem('user');
const accessToken = localStorage.getItem('accessToken');

console.log('Raw user data from localStorage:', userDataRaw);
console.log('Access token exists:', !!accessToken);

if (userDataRaw) {
    try {
        const userData = JSON.parse(userDataRaw);
        console.log('Parsed user data:', userData);
        console.log('User role:', userData.role);
        console.log('User role type:', typeof userData.role);
        console.log('Is role exactly "admin":', userData.role === 'admin');
        console.log('Role comparison (strict):', JSON.stringify(userData.role) === JSON.stringify('admin'));
    } catch (error) {
        console.error('Error parsing user data:', error);
    }
} else {
    console.log('No user data found in localStorage');
}

// Check if we're in the admin context
console.log('Current URL:', window.location.href);
console.log('Path name:', window.location.pathname);
