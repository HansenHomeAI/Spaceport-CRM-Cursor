// Luxury color system with semantic meanings
export const colors = {
  // Status colors - distinct and meaningful
  status: {
    cold: {
      bg: "bg-slate-500/10",
      text: "text-slate-300",
      border: "border-slate-500/20",
      icon: "#94a3b8", // Slate-400
    },
    contacted: {
      bg: "bg-blue-500/10",
      text: "text-blue-300",
      border: "border-blue-500/20",
      icon: "#60a5fa", // Blue-400
    },
    interested: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      border: "border-emerald-500/20",
      icon: "#34d399", // Emerald-400
    },
    closed: {
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      border: "border-amber-500/20",
      icon: "#fbbf24", // Amber-400
    },
    "left voicemail": {
      bg: "bg-orange-500/10",
      text: "text-orange-300",
      border: "border-orange-500/20",
      icon: "#f97316", // Orange-500
    },
  },

  // Interaction type colors
  interaction: {
    call: {
      bg: "bg-green-500/10",
      text: "text-green-300",
      border: "border-green-500/20",
      icon: "#22c55e", // Green-500
    },
    email: {
      bg: "bg-orange-500/10",
      text: "text-orange-300",
      border: "border-orange-500/20",
      icon: "#f97316", // Orange-500
    },
    note: {
      bg: "bg-gray-500/10",
      text: "text-gray-300",
      border: "border-gray-500/20",
      icon: "#6b7280", // Gray-500
    },
  },

  // Priority colors
  priority: {
    high: {
      bg: "bg-red-500/10",
      text: "text-red-300",
      border: "border-red-500/20",
      icon: "#ef4444", // Red-500
    },
    medium: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-300",
      border: "border-yellow-500/20",
      icon: "#eab308", // Yellow-500
    },
    low: {
      bg: "bg-green-500/10",
      text: "text-green-300",
      border: "border-green-500/20",
      icon: "#22c55e", // Green-500
    },
  },

  // Primary brand color (purple) - used sparingly
  primary: {
    bg: "bg-purple-500/10",
    text: "text-purple-300",
    border: "border-purple-500/20",
    icon: "#a855f7", // Purple-500
    gradient: "from-purple-600 to-purple-700",
  },
}
