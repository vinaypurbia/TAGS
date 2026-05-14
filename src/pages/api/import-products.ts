import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const { items } = req.body;

  try {
    // Loop and save each item to your database
    for (const item of items) {
      await saveProductToDB(item); // replace with your DB logic
    }
    res.status(200).json({ message: "Import successful" });
  } catch (err) {
    res.status(500).json({ error: "Import failed" });
  }
}
