async function trigger() {
  try {
    const res = await fetch('http://localhost:3000/api/health');
    const data = await res.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}
trigger();
