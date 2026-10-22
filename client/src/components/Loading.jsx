import Logo from "assets/logo-full.png";
const Loading = () => {
  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <img src={Logo} alt="Logo" className="w-lg" />
    </div>
  );
};

export default Loading;
