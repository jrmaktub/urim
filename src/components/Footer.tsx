import { Sparkles } from "lucide-react";

const Footer = () => {
  const navigation = [
    { name: "Markets", href: "/markets" },
    { name: "Create", href: "/create" },
    { name: "Docs", href: "#" }
  ];

  return (
    <footer className="border-t border-primary/20 py-12 px-6 bg-black">
      <div className="max-w-7xl mx-auto">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-2xl font-bold tracking-tight text-primary">URIM</span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-wrap justify-center gap-8">
            {navigation.map(item => (
              <a 
                key={item.name} 
                href={item.href} 
                className="text-muted-foreground hover:text-primary transition-colors duration-200 text-sm font-bold uppercase tracking-wide"
              >
                {item.name}
              </a>
            ))}
          </nav>

          {/* Badge */}
          <div className="border border-primary/30 px-4 py-2 rounded">
            <span className="text-xs font-bold text-primary uppercase tracking-wide">
              Built on Base
            </span>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t border-primary/20 text-center text-sm text-muted-foreground">
          <p>© 2025 URIM. All quantum states reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;