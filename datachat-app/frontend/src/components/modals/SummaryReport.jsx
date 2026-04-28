// SummaryReport — renders three financial summary tables matching the
// Revenue Breakdown, Processor Transaction Pivot, and New Purchase by Day reports

import { useContext } from "react";
import { DarkModeContext } from "../DarkModeContext";

const fmt = (v) => {
  if (v == null) return "-";
  return "$\u00a0" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtInt = (v) => {
  if (v == null) return "-";
  return Number(v).toLocaleString("en-US");
};

const fmtPct = (v) => {
  if (v == null) return "-";
  return (Number(v) * 100).toFixed(1) + "%";
};

// Shared table style classes
const getThClass = (darkMode) => `px-3 py-1.5 text-left text-xs font-semibold border ${darkMode ? "bg-slate-800 text-slate-200 border-slate-700" : "bg-blue-50 text-gray-700 border-gray-200"}`;
const getTdClass = (darkMode) => `px-3 py-1 text-xs border ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-700 border-gray-100"}`;
const getTdRightClass = (darkMode) => `px-3 py-1 text-xs border text-right font-mono ${darkMode ? "text-slate-300 border-slate-700" : "text-gray-700 border-gray-100"}`;
const getTotalRowClass = (darkMode) => `font-semibold ${darkMode ? "bg-slate-800 text-slate-100 border-y border-slate-700" : "bg-blue-50"}`;

// Report 1: Revenue Breakdown
function RevenueBreakdown({ data }) {
  const { darkMode } = useContext(DarkModeContext);
  const { revenue_by_type, gross_base_revenue, refund_stats, new_purchase, rebill, monthly_rebill, revenue_share } = data;

  const disputeRow = revenue_by_type.find((r) => r.type === "Dispute");
  const refundRow = revenue_by_type.find((r) => r.type === "Refund");
  const totalRefundsAndDisputes = (disputeRow?.revenue || 0) + (refundRow?.revenue || 0);
  const totalRefundsAndDisputesCount = (disputeRow?.count || 0) + (refundRow?.count || 0);

  return (
    <div className="space-y-6">
      <h3 className={`text-sm font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>Revenue Breakdown</h3>

      {/* Revenue by transaction type */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={getThClass(darkMode)}></th>
            <th className={getThClass(darkMode)}>Revenue</th>
            <th className={getThClass(darkMode)}>Count</th>
          </tr>
        </thead>
        <tbody>
          {revenue_by_type.map((row) => (
            <tr key={row.type}>
              <td className={getTdClass(darkMode)}>{row.type}</td>
              <td className={getTdRightClass(darkMode)}>{fmt(row.revenue)}</td>
              <td className={getTdRightClass(darkMode)}>{fmtInt(row.count)}</td>
            </tr>
          ))}
          {refundRow && (
            <>
              <tr>
                <td className={`${getTdClass(darkMode)} italic ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Refund Rate</td>
                <td className={getTdRightClass(darkMode)} colSpan={2}>
                  {refund_stats.total_revenue ? fmtPct(refund_stats.total_annual_refunds / refund_stats.total_revenue) : "-"}
                </td>
              </tr>
            </>
          )}
          <tr>
            <td className={`${getTdClass(darkMode)} italic ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Total Refunds & Disputes</td>
            <td className={getTdRightClass(darkMode)}>{fmt(totalRefundsAndDisputes)}</td>
            <td className={getTdRightClass(darkMode)}>{fmtInt(totalRefundsAndDisputesCount)}</td>
          </tr>
          <tr className={getTotalRowClass(darkMode)}>
            <td className={getTdClass(darkMode)}>Gross Base Revenue</td>
            <td className={getTdRightClass(darkMode)}>{fmt(gross_base_revenue)}</td>
            <td className={getTdRightClass(darkMode)}></td>
          </tr>
        </tbody>
      </table>

      {/* New Purchase Section */}
      <div>
        <h4 className={`text-xs font-bold mb-1 ${darkMode ? "text-slate-200" : "text-gray-800"}`}>New Purchase</h4>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={getThClass(darkMode)}></th>
              <th className={getThClass(darkMode)}>Revenue</th>
              <th className={getThClass(darkMode)}>New Subscribers</th>
            </tr>
          </thead>
          <tbody>
            {new_purchase.rows.map((row) => (
              <tr key={row.pass_name}>
                <td className={getTdClass(darkMode)}>{row.pass_name}</td>
                <td className={getTdRightClass(darkMode)}>{fmt(row.revenue)}</td>
                <td className={getTdRightClass(darkMode)}>{fmtInt(row.new_subscribers)}</td>
              </tr>
            ))}
            <tr className={getTotalRowClass(darkMode)}>
              <td className={getTdClass(darkMode)}>Gross New Purchases</td>
              <td className={getTdRightClass(darkMode)}>{fmt(new_purchase.total_revenue)}</td>
              <td className={getTdRightClass(darkMode)}>{fmtInt(new_purchase.total_subscribers)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rebill Section */}
      <div>
        <h4 className={`text-xs font-bold mb-1 ${darkMode ? "text-slate-200" : "text-gray-800"}`}>Rebill</h4>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={getThClass(darkMode)}></th>
              <th className={getThClass(darkMode)}>Revenue</th>
              <th className={getThClass(darkMode)}>Subscribers</th>
            </tr>
          </thead>
          <tbody>
            {rebill.rows.map((row) => (
              <tr key={row.pass_name}>
                <td className={getTdClass(darkMode)}>{row.pass_name}</td>
                <td className={getTdRightClass(darkMode)}>{fmt(row.revenue)}</td>
                <td className={getTdRightClass(darkMode)}>{fmtInt(row.subscribers)}</td>
              </tr>
            ))}
            <tr className={getTotalRowClass(darkMode)}>
              <td className={getTdClass(darkMode)}>Gross Rebills</td>
              <td className={getTdRightClass(darkMode)}>{fmt(rebill.total_revenue)}</td>
              <td className={getTdRightClass(darkMode)}>{fmtInt(rebill.total_subscribers)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Monthly Rebill Revenue */}
      <div>
        <h4 className={`text-xs font-bold mb-1 ${darkMode ? "text-slate-200" : "text-gray-800"}`}>Monthly Rebill Revenue</h4>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={getThClass(darkMode)}>Billing #</th>
              <th className={getThClass(darkMode)}>Revenue</th>
              <th className={getThClass(darkMode)}>Subscribers</th>
            </tr>
          </thead>
          <tbody>
            {monthly_rebill.rows.map((row) => (
              <tr key={row.billing_number}>
                <td className={getTdClass(darkMode)}>{row.billing_number}</td>
                <td className={getTdRightClass(darkMode)}>{fmt(row.revenue)}</td>
                <td className={getTdRightClass(darkMode)}>{fmtInt(row.subscribers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revenue Share */}
      {revenue_share && revenue_share.length > 0 && (
        <div>
          <h4 className={`text-xs font-bold mb-1 ${darkMode ? "text-slate-200" : "text-gray-800"}`}>Revenue Share</h4>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={getThClass(darkMode)}>Attribution</th>
                <th className={getThClass(darkMode)}>Revenue</th>
                <th className={getThClass(darkMode)}>Rev Share</th>
              </tr>
            </thead>
            <tbody>
              {revenue_share.map((row) => (
                <tr key={row.attribution_method}>
                  <td className={getTdClass(darkMode)}>{row.attribution_method}</td>
                  <td className={getTdRightClass(darkMode)}>{fmt(row.revenue)}</td>
                  <td className={getTdRightClass(darkMode)}>{fmt(row.rev_share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Report 2: Processor Transaction Pivot
function ProcessorPivot({ data }) {
  const { darkMode } = useContext(DarkModeContext);
  return (
    <div>
      <h3 className={`text-sm font-bold mb-2 ${darkMode ? "text-white" : "text-gray-900"}`}>Processor Transaction Pivot</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={getThClass(darkMode)}>Processor Transaction Type</th>
            <th className={getThClass(darkMode)}>Sum of Base Amount</th>
            <th className={getThClass(darkMode)}>Sum of Processor Fee</th>
            <th className={getThClass(darkMode)}>Count of Pass Name</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.type}>
              <td className={getTdClass(darkMode)}>{row.type}</td>
              <td className={getTdRightClass(darkMode)}>{fmt(row.sum_base_amount)}</td>
              <td className={getTdRightClass(darkMode)}>{fmt(row.sum_processor_fee)}</td>
              <td className={getTdRightClass(darkMode)}>{fmtInt(row.count_pass_name)}</td>
            </tr>
          ))}
          <tr className={getTotalRowClass(darkMode)}>
            <td className={getTdClass(darkMode)}>Grand Total</td>
            <td className={getTdRightClass(darkMode)}>{fmt(data.grand_total.sum_base_amount)}</td>
            <td className={getTdRightClass(darkMode)}>{fmt(data.grand_total.sum_processor_fee)}</td>
            <td className={getTdRightClass(darkMode)}>{fmtInt(data.grand_total.count_pass_name)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Report 3: New Purchase by Day 
function PurchaseByDay({ data }) {
  const { darkMode } = useContext(DarkModeContext);
  return (
    <div>
      <h3 className={`text-sm font-bold mb-2 ${darkMode ? "text-white" : "text-gray-900"}`}>New Purchase by Day</h3>
      <div className={`max-h-96 overflow-y-auto border rounded-lg ${darkMode ? "border-slate-800" : "border-gray-200"}`}>
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={getThClass(darkMode)}>Day</th>
              <th className={getThClass(darkMode)}>Count of Transaction Type</th>
              <th className={getThClass(darkMode)}>Sum of Base Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.day_label}>
                <td className={getTdClass(darkMode)}>{row.day_label}</td>
                <td className={getTdRightClass(darkMode)}>{fmtInt(row.count)}</td>
                <td className={getTdRightClass(darkMode)}>{fmt(row.sum_base_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className={getTotalRowClass(darkMode)}>
              <td className={getTdClass(darkMode)}>Grand Total</td>
              <td className={getTdRightClass(darkMode)}>{fmtInt(data.grand_total.count)}</td>
              <td className={getTdRightClass(darkMode)}>{fmt(data.grand_total.sum_base_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Main export
export default function SummaryReport({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-8 w-full">
      {data.report1 && <RevenueBreakdown data={data.report1} />}
      {data.report2 && <ProcessorPivot data={data.report2} />}
      {data.report3 && <PurchaseByDay data={data.report3} />}
    </div>
  );
}
