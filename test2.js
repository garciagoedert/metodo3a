fetch("http://localhost:3000/api/test-db")
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(err => console.error(err));
