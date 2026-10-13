import { useEffect, useState } from 'react';
import { readVideoFromFolder, isLocalFolderSupported, fmtBytes, type LocalVideoRef } from '../lib/localVideoStore';

// Shows where a product's video is saved on the admin's PC, with Copy-path and Play buttons.
// (A PC path is not a web link — customers on the website can't open it — so it is shown as text.)
export default function LocalVideoInfo({ video }: { video: LocalVideoRef }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const play = async () => {
    setBusy(true); setErr('');
    try {
      const f = await readVideoFromFolder(video, true);
      setBlobUrl(URL.createObjectURL(f));
    } catch (e: any) { setErr(e?.message || 'Could not open the video.'); }
    finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(video.path); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setErr('Could not copy automatically — select the path and copy it.'); }
  };

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">🎬 Video saved on this PC</p>
      <p className="text-xs font-bold text-gray-800 break-all select-all">{video.path}</p>
      <p className="text-[10px] text-gray-500 font-bold">
        {fmtBytes(video.sizeBytes)}{video.savedAt ? ` · saved ${new Date(video.savedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy}
          className="bg-white border border-blue-200 hover:border-blue-500 text-blue-700 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition">
          {copied ? 'Copied ✓' : 'Copy path'}
        </button>
        {isLocalFolderSupported() && (
          <button type="button" onClick={play} disabled={busy}
            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition disabled:opacity-50">
            {busy ? 'Opening…' : blobUrl ? 'Reload' : 'Play'}
          </button>
        )}
      </div>
      {blobUrl && <video src={blobUrl} controls loop playsInline className="w-full max-h-72 rounded-lg bg-black" />}
      {err && <p className="text-[11px] font-bold text-red-500">{err}</p>}
      <p className="text-[10px] text-gray-400">This file lives only on the PC where it was saved. It is not on Cloudinary, and customers can't see it on the website unless you use "Show on website" in the Video tab.</p>
    </div>
  );
}
