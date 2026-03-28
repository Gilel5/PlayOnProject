// SummaryReport — renders three financial summary tables matching the
// Revenue Breakdown, Processor Transaction Pivot, and New Purchase by Day reports

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
const thClass = "px-3 py-1.5 text-left text-xs font-semibold text-gray-700 bg-blue-50 border border-gray-200";
const tdClass = "px-3 py-1 text-xs text-gray-700 border border-gray-100";
const tdRightClass = "px-3 py-1 text-xs text-gray-700 border border-gray-100 text-right font-mono";
const totalRowClass = "bg-blue-50 font-semibold";

// Report 1: Revenue Breakdown
function RevenueBreakdown({ data }) {
  const { revenue_by_type, gross_base_revenue, refund_stats, new_purchase, rebill, monthly_rebill, revenue_share } = data;

  const disputeRow = revenue_by_type.find((r) => r.type === "Dispute");
  const refundRow = revenue_by_type.find((r) => r.type === "Refund");
  const totalRefundsAndDisputes = (disputeRow?.revenue || 0) + (refundRow?.revenue || 0);
  const totalRefundsAndDisputesCount = (disputeRow?.count || 0) + (refundRow?.count || 0);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-bold text-gray-900">Revenue Breakdown</h3>

      {/* Revenue by transaction type */}
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={thClass}></th>
            <th className={thClass}>Revenue</th>
            <th className={thClass}>Count</th>
          </tr>
        </thead>
        <tbody>
          {revenue_by_type.map((row) => (
            <tr key={row.type}>
              <td className={tdClass}>{row.type}</td>
              <td className={tdRightClass}>{fmt(row.revenue)}</td>
              <td className={tdRightClass}>{fmtInt(row.count)}</td>
            </tr>
          ))}
          {refundRow && (
            <>
              <tr>
                <td className={`${tdClass} italic text-gray-500`}>Refund Rate</td>
                <td className={tdRightClass} colSpan={2}>
                  {refund_stats.total_revenue ? fmtPct(refund_stats.total_annual_refunds / refund_stats.total_revenue) : "-"}
                </td>
              </tr>
            </>
          )}
          <tr>
            <td className={`${tdClass} italic text-gray-500`}>Total Refunds & Disputes</td>
            <td className={tdRightClass}>{fmt(totalRefundsAndDisputes)}</td>
            <td className={tdRightClass}>{fmtInt(totalRefundsAndDisputesCount)}</td>
          </tr>
          <tr className={totalRowClass}>
            <td className={tdClass}>Gross Base Revenue</td>
            <td className={tdRightClass}>{fmt(gross_base_revenue)}</td>
            <td className={tdRightClass}></td>
          </tr>
        </tbody>
      </table>

      {/* New Purchase Section */}
      <div>
        <h4 className="text-xs font-bold text-gray-800 mb-1">New Purchase</h4>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={thClass}></th>
              <th className={thClass}>Revenue</th>
              <th className={thClass}>New Subscribers</th>
            </tr>
          </thead>
          <tbody>
            {new_purchase.rows.map((row) => (
              <tr key={row.pass_name}>
                <td className={tdClass}>{row.pass_name}</td>
                <td className={tdRightClass}>{fmt(row.revenue)}</td>
                <td className={tdRightClass}>{fmtInt(row.new_subscribers)}</td>
              </tr>
            ))}
            <tr className={totalRowClass}>
              <td className={tdClass}>Gross New Purchases</td>
              <td className={tdRightClass}>{fmt(new_purchase.total_revenue)}</td>
              <td className={tdRightClass}>{fmtInt(new_purchase.total_subscribers)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rebill Section */}
      <div>
        <h4 className="text-xs font-bold text-gray-800 mb-1">Rebill</h4>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={thClass}></th>
              <th className={thClass}>Revenue</th>
              <th className={thClass}>Subscribers</th>
            </tr>
          </thead>
          <tbody>
            {rebill.rows.map((row) => (
              <tr key={row.pass_name}>
                <td className={tdClass}>{row.pass_name}</td>
                <td className={tdRightClass}>{fmt(row.revenue)}</td>
                <td className={tdRightClass}>{fmtInt(row.subscribers)}</td>
              </tr>
            ))}
            <tr className={totalRowClass}>
              <td className={tdClass}>Gross Rebills</td>
              <td className={tdRightClass}>{fmt(rebill.total_revenue)}</td>
              <td className={tdRightClass}>{fmtInt(rebill.total_subscribers)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Monthly Rebill Revenue */}
      <div>
        <h4 className="text-xs font-bold text-gray-800 mb-1">Monthly Rebill Revenue</h4>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={thClass}>Billing #</th>
              <th className={thClass}>Revenue</th>
              <th className={thClass}>Subscribers</th>
            </tr>
          </thead>
          <tbody>
            {monthly_rebill.rows.map((row) => (
              <tr key={row.billing_number}>
                <td className={tdClass}>{row.billing_number}</td>
                <td className={tdRightClass}>{fmt(row.revenue)}</td>
                <td className={tdRightClass}>{fmtInt(row.subscribers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revenue Share */}
      {revenue_share && revenue_share.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-800 mb-1">Revenue Share</h4>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={thClass}>Attribution</th>
                <th className={thClass}>Revenue</th>
                <th className={thClass}>Rev Share</th>
              </tr>
            </thead>
            <tbody>
              {revenue_share.map((row) => (
                <tr key={row.attribution_method}>
                  <td className={tdClass}>{row.attribution_method}</td>
                  <td className={tdRightClass}>{fmt(row.revenue)}</td>
                  <td className={tdRightClass}>{fmt(row.rev_share)}</td>
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
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 mb-2">Processor Transaction Pivot</h3>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className={thClass}>Processor Transaction Type</th>
            <th className={thClass}>Sum of Base Amount</th>
            <th className={thClass}>Sum of Processor Fee</th>
            <th className={thClass}>Count of Pass Name</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.type}>
              <td className={tdClass}>{row.type}</td>
              <td className={tdRightClass}>{fmt(row.sum_base_amount)}</td>
              <td className={tdRightClass}>{fmt(row.sum_processor_fee)}</td>
              <td className={tdRightClass}>{fmtInt(row.count_pass_name)}</td>
            </tr>
          ))}
          <tr className={totalRowClass}>
            <td className={tdClass}>Grand Total</td>
            <td className={tdRightClass}>{fmt(data.grand_total.sum_base_amount)}</td>
            <td className={tdRightClass}>{fmt(data.grand_total.sum_processor_fee)}</td>
            <td className={tdRightClass}>{fmtInt(data.grand_total.count_pass_name)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Report 3: New Purchase by Day 
function PurchaseByDay({ data }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-900 mb-2">New Purchase by Day</h3>
      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={thClass}>Day</th>
              <th className={thClass}>Count of Transaction Type</th>
              <th className={thClass}>Sum of Base Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.day_label}>
                <td className={tdClass}>{row.day_label}</td>
                <td className={tdRightClass}>{fmtInt(row.count)}</td>
                <td className={tdRightClass}>{fmt(row.sum_base_amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-10">
            <tr className={totalRowClass}>
              <td className={tdClass}>Grand Total</td>
              <td className={tdRightClass}>{fmtInt(data.grand_total.count)}</td>
              <td className={tdRightClass}>{fmt(data.grand_total.sum_base_amount)}</td>
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
