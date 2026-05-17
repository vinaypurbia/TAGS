import { useState } from "react";
import Papa from "papaparse";

// Rounds to nearest 5 (e.g. 22.8 → 25, 28 → 30, 31 → 30, 33 → 35)
function roundToNearest5(value: string | number): string {
  const n = parseFloat(String(value));
  if (isNaN(n) || value === '' || value == null) return String(value ?? '');
  return String(Math.round(n / 5) * 5);
}

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

    // Apply price rounding to each row before sending
    const roundedItems = items.map((item) => ({
      ...item,
      originalPrice:   item.originalPrice   ? roundToNearest5(item.originalPrice)   : item.originalPrice,
      discountedPrice: item.discountedPrice  ? roundToNearest5(item.discountedPrice) : item.discountedPrice,
    }));

    const res = await fetch("/api/import-products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: roundedItems }),
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
