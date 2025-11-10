import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface IntroVideoProps {
  onComplete: () => void;
}

const IntroVideo = ({ onComplete }: IntroVideoProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setIsVisible(false);
      setTimeout(onComplete, 800); // Wait for fade out animation
    };

    video.addEventListener("ended", handleEnded);
    
    // Auto-play the video
    video.play().catch(error => {
      console.error("Video autoplay failed:", error);
      // If autoplay fails, show the app after a short delay
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(onComplete, 800);
      }, 1000);
    });

    return () => {
      video.removeEventListener("ended", handleEnded);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="fixed inset-0 z-50 bg-background flex items-center justify-center"
        >
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            muted
            playsInline
          >
            <source src="/intro-video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroVideo;
