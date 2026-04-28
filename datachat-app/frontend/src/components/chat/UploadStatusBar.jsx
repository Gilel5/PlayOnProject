import React from "react";
import { formatBytes, formatTime } from "../../utils/formatters";

/**
 * Renders the upload and processing progress bar and status messages.
 * 
 * @param {Object} props
 * @param {Object} props.uploadStatus - The current status object.
 * @param {boolean} props.darkMode - Whether dark mode is active.
 * @param {Function} props.onCancelUpload - Callback when cancel is clicked.
 */
export default function UploadStatusBar({ uploadStatus, darkMode, onCancelUpload }) {
  if (!uploadStatus) return null;

  return (
    <>
      {uploadStatus.phase === "uploading" && (
        <div className={`mb-2 px-1 text-xs ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-[#5BC5D0] border-t-transparent rounded-full animate-spin" />
            <span>Uploading CSV… {uploadStatus.percent}%</span>
            <span className={darkMode ? "text-slate-400" : "text-gray-400"}>
              ({formatBytes(uploadStatus.loaded)} / {formatBytes(uploadStatus.total)}
              {(() => {
                const elapsed = (Date.now() - uploadStatus.startedAt) / 1000;
                if (elapsed < 0.5 || uploadStatus.loaded === 0) return "";
                const bps = uploadStatus.loaded / elapsed;
                const remainingBytes = uploadStatus.total - uploadStatus.loaded;
                const eta = remainingBytes / bps;
                return ` • ${formatBytes(bps)}/s • ${formatTime(eta)} left`;
              })()}
              )
            </span>
            <button
              onClick={onCancelUpload}
              className="ml-1 text-red-400 hover:text-red-600 underline"
            >
              Cancel
            </button>
          </div>
          <div className={`mt-1 h-1 rounded-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-gray-200"}`}>
            <div
              className="h-full bg-[#5BC5D0] transition-all duration-200"
              style={{ width: `${uploadStatus.percent}%` }}
            />
          </div>
        </div>
      )}

      {uploadStatus.phase === "processing" && (() => {
        const { rows_processed = 0, total_rows = 0, serverPhase, startedAt } = uploadStatus;
        const percent = total_rows > 0 ? Math.min(100, Math.round((rows_processed * 100) / total_rows)) : 0;
        const phaseLabel =
          serverPhase === "queued" ? "Queued (waiting for a DB slot)…" :
            serverPhase === "validating" ? "Validating columns…" :
              serverPhase === "finalizing" ? "Finalizing insert…" :
                serverPhase === "inserting" ? "Inserting rows…" :
                  "Processing…";
        const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
        const rps = elapsed > 0.5 && rows_processed > 0 ? rows_processed / elapsed : 0;
        const eta = rps > 0 && total_rows > rows_processed ? (total_rows - rows_processed) / rps : null;
        return (
          <div className={`mb-2 px-1 text-xs ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#5BC5D0] border-t-transparent rounded-full animate-spin" />
              <span>{phaseLabel} {total_rows > 0 && `${percent}%`}</span>
              {total_rows > 0 && (
                <span className={darkMode ? "text-slate-400" : "text-gray-400"}>
                  ({rows_processed.toLocaleString()} / {total_rows.toLocaleString()} rows
                  {eta !== null && ` • ${formatTime(eta)} left`}
                  )
                </span>
              )}
            </div>
            {total_rows > 0 && (
              <div className={`mt-1 h-1 rounded-full overflow-hidden ${darkMode ? "bg-slate-800" : "bg-gray-200"}`}>
                <div
                  className="h-full bg-[#5BC5D0] transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
          </div>
        );
      })()}

      {uploadStatus.rows_inserted != null && (
        <div className={`mb-2 px-1 text-xs ${uploadStatus.rows_inserted === 0 ? (darkMode ? "text-yellow-400" : "text-yellow-600") : "text-green-600"}`}>
          {uploadStatus.rows_inserted === 0
            ? uploadStatus.message || "No new rows were added."
            : <>✓ {uploadStatus.rows_inserted.toLocaleString()} rows added to <strong>{uploadStatus.table}</strong>
              {uploadStatus.message && <span className={darkMode ? " text-yellow-400" : " text-yellow-600"}> ({uploadStatus.message})</span>}
            </>
          }
        </div>
      )}

      {uploadStatus.error && (
        <div className="mb-2 px-1 text-xs text-red-500">{uploadStatus.error}</div>
      )}
    </>
  );
}
