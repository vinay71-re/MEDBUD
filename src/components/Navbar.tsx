import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";

const Navbar = () => {
  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">MedBud</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-foreground hover:text-primary transition-smooth">
              Features
            </a>
            <a href="#how-it-works" className="text-foreground hover:text-primary transition-smooth">
              How It Works
            </a>
            <a href="#doctors" className="text-foreground hover:text-primary transition-smooth">
              For Doctors
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost">Login</Button>
            <Button className="shadow-soft">Get Started</Button>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
