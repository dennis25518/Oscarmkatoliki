import * as React from "react";
import { FiX, FiCopy, FiCheckCircle } from "react-icons/fi";

interface MpesaGuideModalProps {
  amount?: number;
  onClose: () => void;
}

export function MpesaGuideModal({ amount, onClose }: MpesaGuideModalProps) {
  const [copiedLipa, setCopiedLipa] = React.useState(false);
  const [copiedPhone, setCopiedPhone] = React.useState(false);

  const lipaNamba = "57731332";
  const confirmPhone = "+255753095190";

  const copy = (text: string, which: "lipa" | "phone") => {
    navigator.clipboard.writeText(text).catch(() => {});
    if (which === "lipa") {
      setCopiedLipa(true);
      setTimeout(() => setCopiedLipa(false), 2000);
    } else {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <FiX size={22} />
          </button>
          <div className="text-2xl mb-1">🔧</div>
          <h2 className="text-white font-bold text-lg leading-tight">
            Huduma ya M-Pesa Iko Kwenye Matengenezo
          </h2>
          <p className="text-orange-100 text-sm mt-1">
            Tunaomba msamaha kwa usumbufu huu.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <p className="text-gray-700 text-sm leading-relaxed">
            Mpendwa mteja, kwa sasa malipo ya <strong>M-Pesa (Vodacom)</strong>{" "}
            yanafanyiwa matengenezo.Tafadhali tumia <strong>Lipa Namba</strong>{" "}
            yetu kukamilisha malipo moja kwa moja.
          </p>

          {/* Step 1 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">
              Hatua ya 1 — Lipa kwa Lipa Namba
            </p>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Lipa Namba yetu:</p>
                <p className="text-2xl font-black text-amber-700 tracking-widest">
                  {lipaNamba}
                </p>
                {amount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Kiasi:{" "}
                    <span className="font-bold text-black">
                      Tsh {amount.toLocaleString("sw-TZ")}
                    </span>
                  </p>
                )}
              </div>
              <button
                onClick={() => copy(lipaNamba, "lipa")}
                className="flex items-center gap-2 px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-lg transition flex-shrink-0"
              >
                {copiedLipa ? (
                  <>
                    <FiCheckCircle size={15} /> Imenakiliwa
                  </>
                ) : (
                  <>
                    <FiCopy size={15} /> Nakili
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">
              Hatua ya 2 — Tuma Uthibitisho kwa SMS
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Baada ya kulipa, tuma <strong>ujumbe wa uthibitisho (SMS)</strong>{" "}
              uliopokelewa kutoka M-Pesa kwenye nambari yetu:
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-black text-green-700 tracking-wider">
                {confirmPhone}
              </p>
              <button
                onClick={() => copy(confirmPhone, "phone")}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition flex-shrink-0"
              >
                {copiedPhone ? (
                  <>
                    <FiCheckCircle size={15} /> Imenakiliwa
                  </>
                ) : (
                  <>
                    <FiCopy size={15} /> Nakili
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Tutashughulikia agizo lako mara tu baada ya kupokea uthibitisho
            wako. Asante kwa uvumilivu wako! 🙏
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 border-2 border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition"
          >
            Funga
          </button>
        </div>
      </div>
    </div>
  );
}
