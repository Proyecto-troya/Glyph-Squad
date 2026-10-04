// Trazos del set 1B3 del equipo. Se generaron desde los SVG de la carpeta de diseño, que ya no
// está en el repositorio: ahora este archivo es la fuente.

/** Contenido de cada icono (viewBox 0 0 24 24). Trazo, grosor y color los pone la clase .icon. */
export const PATHS = {
  "alert": "<path d=\"M12 3L21 20H3L12 3ZM12 9V13\"/><circle cx=\"12\" cy=\"16.5\" r=\"0.6\" fill=\"currentColor\"/>",
  "arrow": "<path d=\"M3 12H21M14 5L21 12L14 19\"/>",
  "camera": "<path d=\"M4 7H7L9 4H15L17 7H20Q21 7 21 9V18Q21 20 19 20H5Q3 20 3 18V9Q3 7 4 7Z\"/><circle cx=\"12\" cy=\"13.5\" r=\"3.5\"/>",
  "chart": "<path d=\"M3 3V21H21\"/><rect x=\"7\" y=\"13\" width=\"2\" height=\"5\" rx=\"0.5\" fill=\"currentColor\"/><rect x=\"12\" y=\"9\" width=\"2\" height=\"9\" rx=\"0.5\" fill=\"currentColor\"/><rect x=\"17\" y=\"5\" width=\"2\" height=\"13\" rx=\"0.5\" fill=\"currentColor\"/>",
  "check": "<path d=\"M4 12L9 18L20 6\"/>",
  "cooperative": "<circle cx=\"12\" cy=\"6\" r=\"2.5\"/><circle cx=\"5\" cy=\"10\" r=\"2\"/><circle cx=\"19\" cy=\"10\" r=\"2\"/><path d=\"M8 21V17Q8 12 12 12Q16 12 16 17V21ZM3 21V18Q3 15 6 15M21 21V18Q21 15 18 15\"/>",
  "copy": "<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M16 5V3H5Q3 3 3 5V16H5\"/>",
  "focus": "<path d=\"M3 8V5Q3 3 5 3H8M16 3H19Q21 3 21 5V8M21 16V19Q21 21 19 21H16M8 21H5Q3 21 3 19V16\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
  "leaf": "<path d=\"M12 3C10 6 6 8.5 6 13C6 16.5 8.5 18.5 12 19.5C15.5 18.5 18 16.5 18 13C18 8.5 14 6 12 3Z\"/><path d=\"M12 8V22\"/>",
  "list": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"3\" rx=\"2\"/><path d=\"M9 11H15M9 16H15\"/>",
  "local-ai": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M9.5 3.5V6M14.5 3.5V6M9.5 18V20.5M14.5 18V20.5\"/><path d=\"M9 15C9 11.5 11.5 9 15 9C15 12.5 12.5 15 9 15Z\"/>",
  "message": "<path d=\"M5 4H19Q21 4 21 6V15Q21 17 19 17H10L5 21V17Q3 17 3 15V6Q3 4 5 4Z\"/><path d=\"M8 9H16M8 13H13\"/>",
  "offline": "<path d=\"M7 17H6A4 4 0 0 1 6 9A6 6 0 0 1 17 8A4.5 4.5 0 0 1 19 17H13M3 3L21 21\"/>",
  "plant-age": "<path d=\"M11 21V13M13 21V13M3 21H21M12 14C7 14 4 11 4 7C9 7 12 10 12 14ZM12 11C12 6 15 3 20 3C20 8 17 11 12 11Z\"/>",
  "plate": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><path d=\"M12 3V5M12 19V21M3 12H5M19 12H21\"/>",
  "plus": "<path d=\"M12 4V20M4 12H20\"/>",
  "refresh": "<path d=\"M20 9A8 8 0 0 0 6 6L3 9M3 4V9H8M4 15A8 8 0 0 0 18 18L21 15M21 20V15H16\"/>",
  "scan": "<path d=\"M3 7V3H7M17 3H21V7M21 17V21H17M7 21H3V17M12 6C10 9 7 10 7 13C7 16 9 18 12 18C15 18 17 16 17 13C17 10 14 9 12 6ZM10 15L14 10\"/>",
  "send": "<path d=\"M3 5L21 3L16 21L11 13L3 5ZM11 13L21 3\"/>",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6\"/>",
  "technician": "<circle cx=\"8\" cy=\"7\" r=\"3\"/><path d=\"M3 21V18Q3 13 8 13Q11 13 12 15\"/><rect x=\"14\" y=\"11\" width=\"7\" height=\"10\" rx=\"2\"/><path d=\"M16.5 15H18.5M16.5 18H18.5\"/>",
  "undo": "<path d=\"M9 4L3 10L9 16M3 10H14Q21 10 21 15Q21 20 15 20H12\"/>",
  "upload": "<path d=\"M12 16V3M7 8L12 3L17 8M3 15V19Q3 21 5 21H19Q21 21 21 19V15\"/>",
  "volume": "<path d=\"M3 9H7L12 5V19L7 15H3ZM16 8Q20 12 16 16M18.5 5Q23.5 12 18.5 19\"/>",
  "class-cercospora": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><circle cx=\"12\" cy=\"13.5\" r=\"4\"/><circle cx=\"12\" cy=\"13.5\" r=\"1.5\"/>",
  "class-duda": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\" stroke-dasharray=\"2 3\"/><path d=\"M9.5 11C9.5 7.7 14.5 7.7 14.5 11C14.5 13 12 13 12 15\"/><circle cx=\"12\" cy=\"18\" r=\"0.6\" fill=\"currentColor\"/>",
  "class-minador": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><path d=\"M9 9C15 8 15 11 11 12C7 13 9 16 14 15C17 15 15 18 12 18\"/>",
  "class-phoma": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><path d=\"M12 3C14 6 19 8 19 13C19 17 16 20 12 21C15 19 16.8 16.3 16.8 13C16.8 9 14.5 6 12 3Z\" fill=\"currentColor\"/><path d=\"M11 8V18\"/>",
  "class-roya": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><circle cx=\"9\" cy=\"11\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"10\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"11\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9.5\" cy=\"14\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"13\" cy=\"13.5\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"17\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/>",
  "class-sana": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><path d=\"M12 7V18M12 10.5L9 9M12 13L15 11.5M12 15.5L9.5 14\"/>",
} as const;

/** Marca en un color (logo-marca-mono.svg, viewBox 0 0 64 64): toma el color del texto. */
export const BRAND_MONO = "<path d=\"M32 4a28 28 0 1 1 0 56a28 28 0 1 1 0 -56ZM32 6.5a25.5 25.5 0 1 1 0 51a25.5 25.5 0 1 1 0 -51ZM32 9a23 23 0 1 1 0 46a23 23 0 1 1 0 -46ZM32 10a22 22 0 1 1 0 44a22 22 0 1 1 0 -44Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/><path d=\"M30.7 4H33.3V9H30.7ZM30.7 55H33.3V60H30.7ZM4 30.7H9V33.3H4ZM55 30.7H60V33.3H55Z\" fill=\"currentColor\"/><path d=\"M32 11C29 18 18 23 18 34C18 43 26 46 30.5 50.5L30.5 53C30.5 55 33.5 55 33.5 53L33.5 50.5C38 46 46 43 46 34C46 23 35 18 32 11ZM32 28C26 29 24 33 24.5 38C25 43 28 46 31 48C29 43 29.3 39 31.2 35.5C32.5 33 32.8 30.5 32 28ZM34 28.8C39 31 40.5 35.5 38.8 40.3C37.5 44 34.7 46.5 32.8 47.8C34.3 43.6 33.9 40.9 33.3 38.3C32.4 34.5 35 32.2 34 28.8Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/>";
