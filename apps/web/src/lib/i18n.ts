import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    debug: false,
    resources: {
      en: {
        translation: {
          submit: {
            title: "Submit a Development Request",
            placeholder: "Describe what your community needs...",
            button: "Submit",
            success: "Thank you! Your request has been submitted.",
            category: "Category",
            location: "Your Ward / Area",
            voice: "Record Voice Note"
          },
          dashboard: {
            title: "MP Dashboard",
            priority: "Priority Works",
            submissions: "Total Submissions",
            themes: "Top Themes",
            export: "Export Report"
          },
          themes: {
            roads: "Roads & Transport",
            schools: "Schools & Education",
            water: "Water & Sanitation",
            health: "Healthcare",
            electricity: "Electricity",
            other: "Other"
          }
        }
      },
      hi: {
        translation: {
          submit: {
            title: "विकास अनुरोध सबमिट करें",
            placeholder: "बताएं आपके समुदाय को क्या चाहिए...",
            button: "सबमिट करें",
            success: "धन्यवाद! आपका अनुरोध दर्ज हो गया।",
            category: "श्रेणी",
            location: "आपका वार्ड / क्षेत्र",
            voice: "वॉइस नोट रिकॉर्ड करें"
          },
          dashboard: {
            title: "सांसद डैशबोर्ड",
            priority: "प्राथमिकता कार्य",
            submissions: "कुल सुझाव",
            themes: "मुख्य विषय",
            export: "रिपोर्ट निर्यात करें"
          },
          themes: {
            roads: "सड़क और परिवहन",
            schools: "स्कूल और शिक्षा",
            water: "जल और स्वच्छता",
            health: "स्वास्थ्य सेवा",
            electricity: "बिजली",
            other: "अन्य"
          }
        }
      }
    },
    interpolation: { escapeValue: false }
  });

export default i18n;
