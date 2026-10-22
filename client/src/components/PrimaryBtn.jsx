import { useState } from "react";

import LoadingIcon from "assets/icons/loading-circle.svg?react";

const PrimaryBtn = (props) => {
  const { onClick, disabled, children, type = "button", className = "" } = props;
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`flex justify-center items-center gap-2 cursor-pointer disabled:cursor-auto py-1 px-4 border-solid bg-primary text-white rounded-xl transition hover:opacity-90 disabled:opacity-70 ${className}`}
      onClick={async () => {
        if (!onClick) return;
        setIsLoading(true);
        try {
          await onClick();
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? <LoadingIcon height={20} stroke="white" /> : children}
    </button>
  );
};

export default PrimaryBtn;
