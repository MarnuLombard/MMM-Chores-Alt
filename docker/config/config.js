/* MagicMirror² config for local docker smoke-test of MMM-Chores-Alt. */
let config = {
  address: "0.0.0.0",
  port: 8080,
  basePath: "/",
  ipWhitelist: [],
  useHttps: false,
  language: "en",
  locale: "en-US",
  logLevel: ["INFO", "LOG", "WARN", "ERROR", "DEBUG"],
  timeFormat: 24,
  units: "metric",

  modules: [
    {
      module: "MMM-Chores-Alt",
      position: "fullscreen_below",
      config: {
        parentPin: "1234",
        displayFormat: { prefix: "€", suffix: "" },
        children: [
          {
            id: "alice",
            name: "Alice",
            color: "#ff6b6b",
            chores: [
              { id: "make-bed", label: "Make Bed", icon: "🛏️", points: 0.1 },
              { id: "brush-teeth", label: "Brush Teeth", icon: "🦷", points: 0.1 },
              { id: "get-dressed", label: "Get Dressed", icon: "👕", points: 0.1 },
              { id: "tidy-room", label: "Tidy Room", icon: "🧹", points: 0.2 },
              { id: "homework", label: "Homework", icon: "📚", points: 0.3 },
            ],
          },
          {
            id: "bob",
            name: "Bob",
            color: "#4ecdc4",
            chores: [
              { id: "make-bed", label: "Make Bed", icon: "🛏️", points: 1 },
              { id: "brush-teeth", label: "Brush Teeth", icon: "🦷", points: 1 },
              { id: "tidy-room", label: "Tidy Room", icon: "🧹", points: 2 },
              { id: "homework", label: "Homework", icon: "📚", points: 3 },
            ],
          },
        ],
      },
    },
  ],
}

if (typeof module !== "undefined") { module.exports = config }
