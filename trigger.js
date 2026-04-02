fetch('http://localhost:3000/api/generate-arch')
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
