import { useState, useContext, useCallback, useId } from "react";
import { DarkModeContext } from "../DarkModeContext";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import ChartTypeSelector from "./ChartTypeSelector";
import { X } from "lucide-react";

// Brand-aligned color palette
const LIGHT_COLORS = [
  "#5BC5D0", "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#06b6d4",
];
const DARK_COLORS = [
  "#6366f1", "#5BC5D0", "#fbbf24", "#34d399", "#f87171",
  "#a78bfa", "#f472b6", "#2dd4bf", "#fb923c", "#22d3ee",
];

// Format large numbers for axis labels
function formatAxisValue(value) {
  if (typeof value !== "number") return value;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// Format tooltip values
function formatTooltipValue(value) {
  if (typeof value !== "number") return value;
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Custom tooltip component
function CustomTooltip({ active, payload, label, darkMode }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={`
        rounded-lg px-3 py-2.5 shadow-xl border text-xs
        ${darkMode
          ? "bg-slate-800/95 border-slate-600/50 text-white backdrop-blur-sm"
          : "bg-white/95 border-gray-200/50 text-gray-900 backdrop-blur-sm"
        }
      `}
    >
      <p className={`font-medium mb-1.5 ${darkMode ? "text-slate-300" : "text-gray-500"}`}>
        {label}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className={darkMode ? "text-slate-400" : "text-gray-500"}>{entry.name}:</span>
          <span className="font-semibold ml-auto">{formatTooltipValue(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Single chart renderer
function SingleChart({ chartType, chartData, darkMode, colors, id }) {
  const data = chartData.labels.map((label, i) => {
    const point = { name: label };
    chartData.datasets.forEach((ds) => {
      point[ds.label] = ds.data[i] ?? 0;
    });
    return point;
  });

  const axisStyle = {
    fontSize: 11,
    fill: darkMode ? "#94a3b8" : "#6b7280",
    fontFamily: "'Inter', system-ui, sans-serif",
  };

  const gridColor = darkMode ? "rgba(51, 65, 85, 0.5)" : "rgba(229, 231, 235, 0.8)";

  const commonProps = {
    data,
    margin: { top: 8, right: 20, left: 10, bottom: 8 },
  };

  const renderTooltip = (
    <Tooltip content={<CustomTooltip darkMode={darkMode} />} cursor={{ fill: darkMode ? "rgba(99, 102, 241, 0.08)" : "rgba(91, 197, 208, 0.08)" }} />
  );

  const renderLegend = chartData.datasets.length > 1 ? (
    <Legend
      wrapperStyle={{ fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif" }}
      iconType="circle"
      iconSize={8}
    />
  ) : null;

  if (chartType === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey={chartData.datasets[0]?.label || "value"}
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={50}
            paddingAngle={2}
            stroke={darkMode ? "#1e293b" : "#ffffff"}
            strokeWidth={2}
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          {renderTooltip}
          <Legend
            wrapperStyle={{ fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif" }}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: gridColor }} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatAxisValue} />
          {renderTooltip}
          {renderLegend}
          {chartData.datasets.map((ds, i) => (
            <Line
              key={ds.label}
              type="monotone"
              dataKey={ds.label}
              stroke={colors[i % colors.length]}
              strokeWidth={2.5}
              dot={{ fill: colors[i % colors.length], strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: darkMode ? "#1e293b" : "#fff" }}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart {...commonProps}>
          <defs>
            {chartData.datasets.map((ds, i) => (
              <linearGradient key={ds.label} id={`gradient-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: gridColor }} tickLine={false} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatAxisValue} />
          {renderTooltip}
          {renderLegend}
          {chartData.datasets.map((ds, i) => (
            <Area
              key={ds.label}
              type="monotone"
              dataKey={ds.label}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              fill={`url(#gradient-${id}-${i})`}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart {...commonProps}>
        <defs>
          {chartData.datasets.map((ds, i) => (
            <linearGradient key={ds.label} id={`bar-gradient-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={1} />
              <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.7} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
        <XAxis dataKey="name" tick={axisStyle} axisLine={{ stroke: gridColor }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={formatAxisValue} />
        {renderTooltip}
        {renderLegend}
        {chartData.datasets.map((ds, i) => (
          <Bar
            key={ds.label}
            dataKey={ds.label}
            fill={`url(#bar-gradient-${id}-${i})`}
            radius={[4, 4, 0, 0]}
            animationBegin={0}
            animationDuration={800}
            animationEasing="ease-out"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}


export default function ChartBlock({ chartData }) {
  const { darkMode } = useContext(DarkModeContext);
  const colors = darkMode ? DARK_COLORS : LIGHT_COLORS;
  const blockId = useId().replace(/:/g, ""); // Create a globally unique ID for this block

  // Charts state: array of { id, type } — start with the default chart
  const [charts, setCharts] = useState([
    { id: 1, type: chartData.chart_type || "bar" },
  ]);

  const handleTypeChange = useCallback((chartId, newType) => {
    setCharts((prev) =>
      prev.map((c) => (c.id === chartId ? { ...c, type: newType } : c))
    );
  }, []);

  const handleAddChart = useCallback(() => {
    setCharts((prev) => {
      // Pick a suggested type that isn't already displayed
      const usedTypes = new Set(prev.map((c) => c.type));
      const suggested = chartData.suggested_types || ["bar", "line", "area", "pie"];
      const nextType = suggested.find((t) => !usedTypes.has(t)) || "bar";
      return [...prev, { id: Date.now(), type: nextType }];
    });
  }, [chartData.suggested_types]);

  const handleRemoveChart = useCallback((chartId) => {
    setCharts((prev) => {
      if (prev.length <= 1) return prev; // Always keep at least one chart
      return prev.filter((c) => c.id !== chartId);
    });
  }, []);

  if (!chartData?.labels?.length || !chartData?.datasets?.length) return null;

  return (
    <div className="mt-3 space-y-3">
      {charts.map((chart, index) => (
        <div
          key={chart.id}
          className={`
            rounded-xl overflow-hidden border transition-all duration-300
            ${darkMode
              ? "bg-slate-900/50 border-slate-700/50 shadow-lg shadow-black/20"
              : "bg-gray-50/80 border-gray-200/80 shadow-sm"
            }
          `}
        >
          {/* Chart header */}
          <div className={`flex items-center justify-between px-4 pt-3 pb-2`}>
            <div className="flex-1 min-w-0">
              {index === 0 && chartData.title && (
                <h4 className={`text-xs font-semibold mb-2 truncate ${darkMode ? "text-slate-300" : "text-gray-600"}`}>
                  {chartData.title}
                </h4>
              )}
              <ChartTypeSelector
                activeType={chart.type}
                suggestedTypes={chartData.suggested_types}
                onChange={(t) => handleTypeChange(chart.id, t)}
                onAddChart={handleAddChart}
                canAddChart={index === charts.length - 1} // Only show "Add" on last chart
              />
            </div>
            {charts.length > 1 && (
              <button
                onClick={() => handleRemoveChart(chart.id)}
                className={`
                  ml-2 p-1 rounded-md transition-colors flex-shrink-0
                  ${darkMode
                    ? "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-200"
                  }
                `}
                title="Remove this chart view"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Chart body */}
          <div className="px-2 pb-3">
            <SingleChart
              chartType={chart.type}
              chartData={chartData}
              darkMode={darkMode}
              colors={colors}
              id={`${blockId}-${chart.id}-${chart.type}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
