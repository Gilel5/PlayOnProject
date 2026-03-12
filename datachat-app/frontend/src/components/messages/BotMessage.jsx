import PdfAttachment from "../PdfAttachment";

export default function BotMessage({ text, attachment }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="#0d9488"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="max-w-lg text-sm text-gray-800">
        <p className="mb-2">{text}</p>
        {attachment && <PdfAttachment name={attachment} />}
      </div>
    </div>
  );
}
