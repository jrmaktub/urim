import { Sparkles } from "lucide-react";

const Footer = () => {
  const navigation = [
    { name: "Home", href: "#" },
    { name: "Market", href: "#" },
    { name: "Docs", href: "#" },
    { name: "Team", href: "#" },
  ];

  return (
    <footer className="relative border-t border-border/50 py-12 px-6">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-2xl font-bold tracking-tight">Urim</span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-wrap justify-center gap-8">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-muted-foreground hover:text-foreground transition-colors duration-200 text-sm font-medium"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* ETHGlobal Badge */}
          <div className="glass-card px-4 py-2 rounded-full border border-primary/30">
            <span className="text-xs font-semibold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Built for ETHGlobal 2025
            </span>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t border-border/30 text-center text-sm text-muted-foreground">
          <p>
            © 2025 Urim. All quantum states reserved. Testnet only - for demonstration purposes.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
