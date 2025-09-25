# SplitExpense

Aplicación móvil creada con [Expo](https://expo.dev/) y React Native para registrar gastos compartidos desde el teléfono y obtener quién debe pagar a quién. Pensada para ejecutarse fácilmente en Android usando la app **Expo Go** o generando un `.apk`/`.aab` listo para instalar.

## ✨ Características

- Añade y elimina participantes en cuestión de segundos.
- Registra gastos indicando descripción, importe, pagador y personas implicadas.
- Calcula automáticamente el balance individual y propone los pagos necesarios para equilibrar las cuentas.
- Guarda los datos de forma persistente en el dispositivo con `AsyncStorage` para que no se pierdan entre sesiones.
- Permite exportar la información a un archivo `.json` y volver a importarla pegando el contenido en la propia app.

## 📱 Instalación y ejecución en Android

1. **Instala dependencias**

   ```bash
   npm install
   ```

2. **Instala Expo Go en tu móvil Android**

   Descárgala desde [Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent).

3. **Arranca el proyecto en tu ordenador**

   ```bash
   npm start
   ```

   - Se abrirá la interfaz de Expo en tu terminal o navegador.
   - Escanea el código QR con la cámara o directamente con la app Expo Go.
   - Asegúrate de que el móvil y el ordenador estén en la misma red Wi‑Fi.

4. **Prueba la app en tu móvil**

   Expo Go descargará el bundle y cargará la app con soporte de recarga en caliente.

### Generar un instalable `.apk` o `.aab`

Cuando quieras instalar la app sin depender de Expo Go puedes crear un binario nativo usando [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx expo login        # si aún no has iniciado sesión en Expo
npx expo prebuild     # prepara los proyectos nativos
npx expo run:android  # genera un .apk de desarrollo (debug)
```

Para builds de distribución utiliza `eas build --platform android`. En el `app.json` ya está configurado el identificador `com.splitexpense.app` que puedes personalizar. Si necesitas iconos o splash screen personalizados crea un directorio `assets/` y actualiza `app.json` con las rutas a tus imágenes.

## 🧪 Pruebas automatizadas

El proyecto incorpora pruebas unitarias que verifican los cálculos de balances y pagos sugeridos.

```bash
npm test
```

## 🧭 Estructura del proyecto

```
├── App.js                 # Pantallas y lógica principal de la aplicación
├── app.json               # Configuración de Expo
├── src/
│   ├── calculations.js    # Funciones puras para calcular resúmenes y pagos
│   └── __tests__/         # Tests con Jest sobre la lógica de negocio
├── package.json
└── README.md
```

## 📄 Licencia

MIT. Siéntete libre de adaptarla a tus necesidades.
