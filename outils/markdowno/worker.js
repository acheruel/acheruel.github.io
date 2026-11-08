// MarkDownO : travailleur Pyodide. MarkItDown (Microsoft, MIT) tourne ici, en Python compilé en
// WebAssembly, sans bloquer la page. Le moteur est téléchargé une fois (CDN jsDelivr et PyPI),
// puis mis en cache par le navigateur ; les fichiers convertis ne quittent jamais l'appareil.
/* global importScripts, loadPyodide */
const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.29.5/full/";
importScripts(PYODIDE + "pyodide.js");

// Paquets fournis par Pyodide (compilés pour WebAssembly).
const PYODIDE_PKGS = ["micropip", "beautifulsoup4", "soupsieve", "charset-normalizer", "cryptography", "lxml", "numpy", "pandas",
  "pillow", "python-dateutil", "pytz", "requests", "six", "typing-extensions", "xlrd", "certifi", "idna", "urllib3"];
// Paquets purement Python récupérés sur PyPI, versions épinglées (testées ensemble).
const PYPI = ["markitdown==0.1.9", "markdownify==1.2.3", "mammoth==1.13.0", "cobble==0.1.4", "defusedxml==0.7.1",
  "python-pptx==1.0.2", "xlsxwriter==3.3.1", "openpyxl==3.1.5", "et-xmlfile==2.0.0", "olefile==0.47",
  "pdfminer.six==20260107", "pdfplumber==0.11.10"];

// magika (détection du type par réseau de neurones, ONNX) et pypdfium2 (rendu PDF) n'existent pas en
// WebAssembly. MarkItDown ne s'en sert que pour deviner le type d'un fichier sans extension et pour
// afficher des pages : des modules factices suffisent, l'extension du fichier est toujours connue.
const BOOT = `
import sys, types, io, csv
class _R:
    status = "unknown"
class _Magika:
    def identify_stream(self, s): return _R()
    def identify_bytes(self, b): return _R()
    def identify_path(self, p): return _R()
for _name in ("magika", "pypdfium2"):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)
sys.modules["magika"].Magika = _Magika

from markitdown import MarkItDown
try:
    from markitdown import __version__ as MID_VERSION
except Exception:
    MID_VERSION = "0.1.9"
_mid = MarkItDown(enable_plugins=False)

def _decode(raw):
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode("utf-8", "replace")

def _csv_to_commas(raw, ext):
    # Excel en français enregistre souvent des CSV séparés par « ; » : on les ramène à des virgules.
    text = _decode(raw)
    sample = text[:20000]
    delim = "\\t" if ext == ".tsv" else None
    if delim is None:
        try:
            delim = csv.Sniffer().sniff(sample, delimiters=",;\\t|").delimiter
        except csv.Error:
            delim = ","
    if delim == "," and ext == ".csv":
        return text.encode("utf-8")
    out = io.StringIO()
    w = csv.writer(out)
    for row in csv.reader(io.StringIO(text), delimiter=delim):
        w.writerow(row)
    return out.getvalue().encode("utf-8")

def convert(data, name):
    ext = ("." + name.rsplit(".", 1)[-1].lower()) if "." in name else ""
    raw = bytes(data)
    if ext in (".csv", ".tsv"):
        raw = _csv_to_commas(raw, ext)
        ext = ".csv"
    res = _mid.convert_stream(io.BytesIO(raw), file_extension=ext)
    return [res.markdown or "", res.title or ""]
`;

let py = null;
let booting = null;
const post = msg => self.postMessage(msg);

async function boot() {
  post({ type: "progress", step: 1 });
  py = await loadPyodide({ indexURL: PYODIDE });
  post({ type: "progress", step: 2 });
  await py.loadPackage(PYODIDE_PKGS, { messageCallback: () => {}, errorCallback: () => {} });
  post({ type: "progress", step: 3 });
  const micropip = py.pyimport("micropip");
  await micropip.install.callKwargs(PYPI, { deps: false });
  post({ type: "progress", step: 4 });
  py.runPython(BOOT);
  post({ type: "ready", version: py.globals.get("MID_VERSION"), python: py.runPython("import sys; sys.version.split()[0]") });
}

self.onmessage = async e => {
  const msg = e.data;
  if (msg.type === "init") {
    if (!booting) booting = boot().catch(err => { booting = null; post({ type: "fatal", error: String(err && err.message || err) }); throw err; });
    return;
  }
  if (msg.type === "convert") {
    try {
      if (!booting) booting = boot();
      await booting;
      const convert = py.globals.get("convert");
      const out = convert(msg.bytes, msg.name);
      const [markdown, title] = out.toJs();
      out.destroy();
      convert.destroy();
      post({ type: "done", id: msg.id, markdown, title });
    } catch (err) {
      const text = String(err && err.message || err);
      // Dernière ligne d'une trace Python : le message utile.
      const last = text.trim().split("\n").filter(Boolean).pop() || text;
      post({ type: "error", id: msg.id, error: last.slice(0, 400) });
    }
  }
};
