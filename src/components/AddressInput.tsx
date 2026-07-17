import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type KakaoPostcodeData = {
  zonecode: string;
  userSelectedType: "R" | "J";
  roadAddress: string;
  jibunAddress: string;
  bname: string;
  buildingName: string;
  apartment: "Y" | "N";
};

type KakaoPostcode = {
  embed: (container: HTMLElement) => void;
};

declare global {
  interface Window {
    kakao?: {
      Postcode: new (options: {
        oncomplete: (data: KakaoPostcodeData) => void;
        width?: string;
        height?: string;
      }) => KakaoPostcode;
    };
  }
}

const POSTCODE_SCRIPT_ID = "kakao-postcode-script";
const POSTCODE_SCRIPT_SRC = "https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
let postcodeScriptPromise: Promise<void> | undefined;

function loadPostcodeScript() {
  if (window.kakao?.Postcode) return Promise.resolve();
  if (postcodeScriptPromise) return postcodeScriptPromise;

  postcodeScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(POSTCODE_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const handleLoad = () => {
      if (window.kakao?.Postcode) resolve();
      else {
        script.remove();
        reject(new Error("주소 검색 API가 준비되지 않았습니다."));
      }
    };
    const handleError = () => {
      script.remove();
      reject(new Error("주소 검색 API를 불러오지 못했습니다."));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.id = POSTCODE_SCRIPT_ID;
      script.src = POSTCODE_SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    postcodeScriptPromise = undefined;
    throw error;
  });

  return postcodeScriptPromise;
}

function selectedAddress(data: KakaoPostcodeData) {
  const address = data.userSelectedType === "R" ? data.roadAddress : data.jibunAddress;
  const extras: string[] = [];
  if (data.userSelectedType === "R" && /[동로가]$/.test(data.bname)) extras.push(data.bname);
  if (data.userSelectedType === "R" && data.apartment === "Y" && data.buildingName) extras.push(data.buildingName);
  const extraAddress = extras.length ? ` (${extras.join(", ")})` : "";
  return `${data.zonecode ? `[${data.zonecode}] ` : ""}${address}${extraAddress}`.trim();
}

export function AddressInput({ label = "주소", value, onChange }: { label?: string; value: string; onChange: (value: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = searchContainerRef.current;
    if (!searchOpen || !container || !window.kakao?.Postcode) return;
    container.replaceChildren();
    new window.kakao.Postcode({
      width: "100%",
      height: "100%",
      oncomplete: (data) => {
        onChangeRef.current(selectedAddress(data));
        setSearchOpen(false);
      }
    }).embed(container);
  }, [searchOpen]);

  const openPostcode = async () => {
    setLoading(true);
    try {
      await loadPostcodeScript();
      if (!window.kakao?.Postcode) throw new Error("주소 검색 API가 준비되지 않았습니다.");
      setSearchOpen(true);
    } catch (error) {
      window.alert(error instanceof Error ? `${error.message} 주소는 직접 입력할 수 있습니다.` : "주소 검색을 열지 못했습니다. 주소는 직접 입력할 수 있습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="address-field">
      <span className="address-label">{label}</span>
      <div className="address-input-row">
        <input
          aria-label={label}
          value={value}
          placeholder="주소를 검색하거나 직접 입력"
          autoComplete="street-address"
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="ghost address-search-button" disabled={loading} onClick={openPostcode}>
          <Search size={16} /> {loading ? "불러오는 중" : "주소 검색"}
        </button>
      </div>
      {searchOpen && (
        <div className="address-search-backdrop" role="dialog" aria-modal="true" aria-label="국내 주소 검색">
          <div className="address-search-modal">
            <div className="address-search-head">
              <strong>국내 주소 검색</strong>
              <button type="button" className="icon" aria-label="주소 검색 닫기" title="주소 검색 닫기" onClick={() => setSearchOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div ref={searchContainerRef} className="address-search-frame" />
          </div>
        </div>
      )}
    </div>
  );
}
