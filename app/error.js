"use client";

export default function ErrorPage({ error, reset }) {
  return (
    <main>
      <h1>Algo salio mal</h1>
      <p>Detalle: {error?.message || "Error desconocido"}</p>
      <button onClick={() => reset()}>Reintentar</button>
    </main>
  );
}
