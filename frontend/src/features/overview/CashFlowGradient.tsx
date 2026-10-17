/** Provide the chart's local SVG fill definition.
 * @returns {JSX.Element} SVG gradient. */
export function CashFlowGradient() {
  return (
    <defs>
      <linearGradient
        id="incomeFill"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stopColor="#548c70"
          stopOpacity="0.13"
        />
        <stop
          offset="100%"
          stopColor="#548c70"
          stopOpacity="0"
        />
      </linearGradient>
    </defs>
  );
}
