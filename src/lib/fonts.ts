import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";

const chakraPetch = localFont({
  src: [
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_light_italic.ttf",
      weight: "300",
      style: "italic",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_medium_italic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_semibold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_semibold_italic.ttf",
      weight: "600",
      style: "italic",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/chakra-petch/chakra_petch_bold_italic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-chakra-petch",
});

const googleSans = localFont({
  src: [
    {
      path: "../../public/fonts/google-sans/google_sans_variable.ttf",
      style: "normal",
    },
    {
      path: "../../public/fonts/google-sans/google_sans_variable_italic.ttf",
      style: "italic",
    },
  ],
  variable: "--font-google-sans",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export { chakraPetch, geistMono, googleSans };
