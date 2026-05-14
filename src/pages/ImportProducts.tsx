import { useState } from "react";
import Papa from "papaparse";

export default function ImportProducts() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        setData(results.data);
        await uploadToServer(results.data);
      },
    });
  };

  const uploadToServer = async (items) => {
    setStatus("Uploading...");
    const res = await fetch("/api/import-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (res.ok) setStatus("✅ Import Successful!");
    else setStatus("❌ Import Failed!");
  };

  return (
    <div>
      <h1>Import Products</h1>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      <p>{status}</p>
    </div>
  );
}
