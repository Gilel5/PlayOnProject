import React, { useState } from "react";

// Shared month options to deduplicate the dropdown logic
function MonthSelect({ value, onChange, darkMode, label }) {
  return (
    <div>
      <label className="block text-sm mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg px-3 py-2 text-sm border ${
          darkMode
            ? "bg-slate-900 border-slate-700 text-white"
            : "bg-white border-gray-300 text-gray-900"
        }`}
      >
        <option value="01">January</option>
        <option value="02">February</option>
        <option value="03">March</option>
        <option value="04">April</option>
        <option value="05">May</option>
        <option value="06">June</option>
        <option value="07">July</option>
        <option value="08">August</option>
        <option value="09">September</option>
        <option value="10">October</option>
        <option value="11">November</option>
        <option value="12">December</option>
      </select>
    </div>
  );
}

/**
 * Modal to configure and download Excel summary reports.
 * 
 * @param {Object} props
 * @param {boolean} props.darkMode - Whether dark mode is active.
 * @param {Function} props.onClose - Callback to close the modal.
 * @param {Function} props.onGenerate - Async callback(type, params) to trigger download.
 * @param {boolean} props.isGenerating - Whether a generation is currently in progress.
 */
export default function ReportModal({ darkMode, onClose, onGenerate, isGenerating }) {
  const [reportType, setReportType] = useState("annual");
  const [reportYear, setReportYear] = useState("2024");
  const [reportMonthValue, setReportMonthValue] = useState("01");
  const [reportMonthYear, setReportMonthYear] = useState("2024");
  const [multiStartMonthValue, setMultiStartMonthValue] = useState("01");
  const [multiStartMonthYear, setMultiStartMonthYear] = useState("2024");
  const [multiEndMonthValue, setMultiEndMonthValue] = useState("12");
  const [multiEndMonthYear, setMultiEndMonthYear] = useState("2024");

  const handleDownload = () => {
    let params = {};
    if (reportType === "annual") {
      params = { year: parseInt(reportYear, 10) };
    } else if (reportType === "single_month") {
      params = { month: `${reportMonthYear}-${reportMonthValue}` };
    } else if (reportType === "multimonth") {
      params = {
        start_month: `${multiStartMonthYear}-${multiStartMonthValue}`,
        end_month: `${multiEndMonthYear}-${multiEndMonthValue}`,
      };
    }
    onGenerate(reportType, params);
  };

  const isDownloadDisabled =
    isGenerating ||
    (reportType === "annual" && !reportYear) ||
    (reportType === "single_month" && (!reportMonthValue || !reportMonthYear)) ||
    (reportType === "multimonth" &&
      (!multiStartMonthValue || !multiStartMonthYear || !multiEndMonthValue || !multiEndMonthYear));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className={`rounded-xl shadow-lg p-5 w-96 ${
          darkMode ? "bg-slate-800 text-white" : "bg-white text-gray-900"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium mb-4">Generate Report</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setReportType("annual")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm ${
              reportType === "annual"
                ? "bg-[#5BC5D0] text-black"
                : darkMode
                  ? "bg-slate-700 text-slate-200"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            Annual
          </button>
          <button
            onClick={() => setReportType("single_month")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm ${
              reportType === "single_month"
                ? "bg-[#5BC5D0] text-black"
                : darkMode
                  ? "bg-slate-700 text-slate-200"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            Single Month
          </button>
          <button
            onClick={() => setReportType("multimonth")}
            className={`flex-1 px-3 py-2 rounded-lg text-sm ${
              reportType === "multimonth"
                ? "bg-[#5BC5D0] text-black"
                : darkMode
                  ? "bg-slate-700 text-slate-200"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            Multi-Month
          </button>
        </div>

        <div className="space-y-4">
          {reportType === "annual" && (
            <div>
              <label className="block text-sm mb-2">Year</label>
              <input
                type="number"
                min="2000"
                max="2100"
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 text-sm border ${
                  darkMode
                    ? "bg-slate-900 border-slate-700 text-white"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
              />
            </div>
          )}

          {reportType === "single_month" && (
            <div className="grid grid-cols-2 gap-3">
              <MonthSelect
                label="Month"
                value={reportMonthValue}
                onChange={setReportMonthValue}
                darkMode={darkMode}
              />
              <div>
                <label className="block text-sm mb-2">Year</label>
                <input
                  type="number"
                  min="2000"
                  max="2100"
                  value={reportMonthYear}
                  onChange={(e) => setReportMonthYear(e.target.value)}
                  className={`w-full rounded-lg px-3 py-2 text-sm border ${
                    darkMode
                      ? "bg-slate-900 border-slate-700 text-white"
                      : "bg-white border-gray-300 text-gray-900"
                  }`}
                />
              </div>
            </div>
          )}

          {reportType === "multimonth" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MonthSelect
                  label="Start Month"
                  value={multiStartMonthValue}
                  onChange={setMultiStartMonthValue}
                  darkMode={darkMode}
                />
                <div>
                  <label className="block text-sm mb-2">Start Year</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={multiStartMonthYear}
                    onChange={(e) => setMultiStartMonthYear(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${
                      darkMode
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MonthSelect
                  label="End Month"
                  value={multiEndMonthValue}
                  onChange={setMultiEndMonthValue}
                  darkMode={darkMode}
                />
                <div>
                  <label className="block text-sm mb-2">End Year</label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={multiEndMonthYear}
                    onChange={(e) => setMultiEndMonthYear(e.target.value)}
                    className={`w-full rounded-lg px-3 py-2 text-sm border ${
                      darkMode
                        ? "bg-slate-900 border-slate-700 text-white"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              darkMode ? "hover:bg-slate-700 text-slate-200" : "hover:bg-gray-100 text-gray-600"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloadDisabled}
            className="px-3 py-1.5 text-sm rounded-lg bg-[#5BC5D0] text-black hover:opacity-90 disabled:opacity-50"
          >
            {isGenerating ? "Generating..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
