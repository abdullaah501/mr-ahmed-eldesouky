export function Card({ children, className = "", hover = true, padding = "p-6", ...props }) {
  return (
    <div
      className={`bg-card border border-border rounded-2xl shadow-sm ${hover ? "hover:shadow-md hover:border-border-strong hover:-translate-y-0.5" : ""} transition-all duration-200 ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }) {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function FeatureCard({ children, className = "", ...props }) {
  return (
    <div className={`bg-card border border-border rounded-3xl shadow-md p-6 sm:p-8 ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;
