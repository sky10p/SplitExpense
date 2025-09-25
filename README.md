# SplitExpense

Aplicación web ligera para repartir gastos compartidos desde el móvil o el ordenador. Ideal para despedidas, viajes o cualquier plan en grupo donde varias personas pagan distintas cantidades.

## ✨ Características

- Añade participantes y controla quién forma parte de cada gasto.
- Registra pagos con descripción, importe y la persona que abonó la cuenta.
- Calcula automáticamente el balance de cada integrante y muestra los pagos sugeridos para equilibrar las cuentas.
- Guarda los datos en el dispositivo mediante `localStorage` para que puedas cerrar y volver sin perder información.
- Exporta los datos a un archivo `.json` y vuelve a importarlos en otro dispositivo para seguir donde lo dejaste.
- Interfaz responsive pensada para usarse cómodamente en móviles Android.

## 🚀 Puesta en marcha

1. **Instala dependencias**

   ```bash
   npm install
   ```

2. **Entorno de desarrollo** (recarga en caliente)

   ```bash
   npm run dev
   ```

   Vite abrirá la aplicación en `http://localhost:5173`.

3. **Generar versión de producción**

   ```bash
   npm run build
   ```

   El resultado queda en la carpeta `dist/`. Puedes comprobarla con:

   ```bash
   npm run preview
   ```

## 🧭 Cómo usarla

1. Añade todas las personas del grupo.
2. Registra cada gasto indicando quién pagó y qué participantes deben compartirlo.
3. En el panel *Resumen* verás cuánto ha pagado cada persona, su parte proporcional y el saldo final.
4. La sección *Quién paga a quién* propone los pagos más sencillos para saldar la cuenta.
5. Necesitas guardar o trasladar la información? Usa **Exportar datos** para descargar un `.json` y **Importar datos** para cargarlo de nuevo en otro dispositivo o navegador.
6. Si quieres empezar de cero, pulsa **Borrar todo**.

## 🧱 Estructura del proyecto

```
├── app.js          # Lógica principal y gestión de estado/localStorage
├── index.html      # Marcado principal de la aplicación
├── styles.css      # Estilos responsive enfocados a móviles
├── package.json    # Scripts de ejecución y configuración de Vite
└── README.md
```

## 📄 Licencia

MIT. Puedes adaptarla a tus necesidades.
