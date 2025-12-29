import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, MapPin, Stethoscope, CreditCard, CheckCircle, Download, 
  Phone, Mail, User, GraduationCap, Clock, Award, Star, Building2
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { z } from "zod";

type Clinic = {
  id: string;
  clinic_name: string;
  address: string;
  city: string;
  pincode: string;
  state: string;
};

type Doctor = {
  id: string;
  user_id: string;
  specialization: string;
  consultation_fee: number;
  experience_years: number;
  bio: string;
  education: string;
  is_active: boolean;
  profiles: { full_name: string };
};

type TimeSlot = {
  time: string;
  available: boolean;
};

type BookingDetails = {
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  symptoms: string;
};

const bookingSchema = z.object({
  patientName: z.string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s\-']+$/, "Name can only contain letters, spaces, hyphens, and apostrophes"),
  patientEmail: z.string()
    .trim()
    .email("Invalid email address")
    .max(255, "Email must be less than 255 characters"),
  patientPhone: z.string()
    .trim()
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits")
    .max(15, "Phone number is too long"),
  symptoms: z.string()
    .trim()
    .max(1000, "Symptoms description must be less than 1000 characters")
    .optional()
});

const PublicBooking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [tokenNumber, setTokenNumber] = useState<number | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  
  const [bookingDetails, setBookingDetails] = useState<BookingDetails>({
    patientName: "",
    patientEmail: "",
    patientPhone: "",
    symptoms: ""
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (step === 1) {
      fetchClinics();
    }
  }, [step]);

  useEffect(() => {
    if (selectedClinic) {
      fetchDoctors();
    }
  }, [selectedClinic]);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      generateTimeSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const fetchClinics = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clinics")
      .select("id, clinic_name, address, city, pincode, state")
      .eq("city", "Vizag");
    
    if (error) {
      toast({ title: "Error loading hospitals", variant: "destructive" });
    } else {
      setClinics(data || []);
    }
    setLoading(false);
  };

  const fetchDoctors = async () => {
    setLoading(true);
    // Fetch ALL active doctors
    const { data: doctorsData, error: doctorsError } = await supabase
      .from("doctors")
      .select("*")
      .eq("is_active", true);
    
    if (doctorsError) {
      toast({ title: "Error loading doctors", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch profiles for these doctors
    const userIds = (doctorsData || []).map(d => d.user_id);
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    // Combine doctors with their profile names
    const transformedData = (doctorsData || []).map(doc => {
      const profile = profilesData?.find(p => p.id === doc.user_id);
      return {
        ...doc,
        profiles: { full_name: profile?.full_name || 'Dr. ' + doc.specialization }
      };
    }) as Doctor[];
    
    setDoctors(transformedData);
    setLoading(false);
  };

  const generateTimeSlots = () => {
    const slots: TimeSlot[] = [];
    const startHour = 9;
    const endHour = 18;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({ time, available: true });
      }
    }
    setTimeSlots(slots);
  };

  const handleClinicSelect = (clinic: Clinic) => {
    setSelectedClinic(clinic);
    setStep(2);
  };

  const handleDoctorSelect = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setStep(3); // Go to doctor profile view
  };

  const handleBookDoctor = () => {
    setStep(4); // Go to time slot selection
  };

  const handleTimeSelect = () => {
    if (!selectedDate || !selectedTime) {
      toast({ title: "Please select date and time", variant: "destructive" });
      return;
    }
    setStep(5); // Go to patient details
  };

  const validateBookingDetails = () => {
    try {
      bookingSchema.parse(bookingDetails);
      setValidationErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0].toString()] = err.message;
          }
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handlePayment = async () => {
    if (!validateBookingDetails()) {
      toast({ title: "Please fix the errors in the form", variant: "destructive" });
      return;
    }

    if (!selectedDoctor || !selectedClinic) return;

    setLoading(true);
    try {
      // Create appointment
      const { data: appointment, error: apptError } = await supabase
        .from("appointments")
        .insert({
          doctor_id: selectedDoctor.id,
          appointment_date: selectedDate,
          appointment_time: selectedTime,
          symptoms: bookingDetails.symptoms || null,
          patient_name: bookingDetails.patientName.trim(),
          patient_email: bookingDetails.patientEmail.trim(),
          patient_phone: bookingDetails.patientPhone.trim(),
          payment_status: "completed",
          payment_method: paymentMethod,
          status: "confirmed"
        })
        .select()
        .single();

      if (apptError) throw apptError;

      // Get next token number for the day
      const { data: existingTokens } = await supabase
        .from("tokens")
        .select("token_number")
        .eq("doctor_id", selectedDoctor.id)
        .eq("token_date", selectedDate)
        .order("token_number", { ascending: false })
        .limit(1);

      const nextTokenNumber = existingTokens && existingTokens.length > 0 
        ? existingTokens[0].token_number + 1 
        : 1;

      // Create token
      const { data: token, error: tokenError } = await supabase
        .from("tokens")
        .insert({
          doctor_id: selectedDoctor.id,
          appointment_id: appointment.id,
          token_number: nextTokenNumber,
          token_date: selectedDate,
          token_type: "appointment",
          status: "waiting",
          estimated_time: `${selectedDate}T${selectedTime}`
        })
        .select()
        .single();

      if (tokenError) throw tokenError;

      setTokenNumber(nextTokenNumber);
      setAppointmentId(appointment.id);
      setStep(6);
      toast({ title: "Appointment booked successfully!" });
    } catch (error: any) {
      toast({ title: "Error booking appointment", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BookingDetails, value: string) => {
    setBookingDetails(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const downloadReceipt = () => {
    const receiptContent = `
MEDBUD - APPOINTMENT RECEIPT
========================================

Booking Details:
----------------
Appointment ID: ${appointmentId}
Token Number: #${tokenNumber}

Patient Information:
-------------------
Name: ${bookingDetails.patientName}
Email: ${bookingDetails.patientEmail}
Phone: ${bookingDetails.patientPhone}

Hospital Details:
-----------------
Hospital: ${selectedClinic?.clinic_name}
Address: ${selectedClinic?.address}, ${selectedClinic?.city}
Pincode: ${selectedClinic?.pincode}

Doctor Details:
---------------
Doctor: ${selectedDoctor?.profiles.full_name}
Specialization: ${selectedDoctor?.specialization}
Education: ${selectedDoctor?.education}
Experience: ${selectedDoctor?.experience_years} years

Appointment Details:
--------------------
Date: ${selectedDate}
Time: ${selectedTime}
Symptoms: ${bookingDetails.symptoms || "N/A"}

Payment Details:
----------------
Consultation Fee: ₹${selectedDoctor?.consultation_fee}
Payment Method: ${paymentMethod.toUpperCase()}
Payment Status: COMPLETED

========================================
Please arrive 10 minutes before your scheduled time.
Bring a valid ID and this receipt.

Thank you for choosing MedBud!
    `;

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MedBud-Receipt-${appointmentId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const goBack = () => {
    if (step === 1) {
      navigate("/");
    } else if (step === 3) {
      setStep(2);
      setSelectedDoctor(null);
    } else if (step === 4) {
      setStep(3);
    } else {
      setStep(step - 1);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1: return "Select Hospital";
      case 2: return "Choose Doctor";
      case 3: return "Doctor Profile";
      case 4: return "Select Time Slot";
      case 5: return "Patient Details & Payment";
      case 6: return "Booking Confirmed";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {step < 6 && (
            <Button
              variant="ghost"
              onClick={goBack}
              className="mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 overflow-x-auto">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div key={s} className="flex items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {step > s ? <CheckCircle className="h-4 w-4" /> : s}
                  </div>
                  {s < 6 && <div className={`h-1 w-8 md:w-12 mx-1 md:mx-2 transition-all duration-300 ${step > s ? "bg-primary" : "bg-muted"}`} />}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">{getStepTitle()}</h2>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Select Hospital */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-muted-foreground text-center mb-6">
                  Select a hospital in Vizag to view available doctors
                </p>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading hospitals...</p>
                  </div>
                ) : clinics.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No hospitals available in Vizag at the moment</p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {clinics.map((clinic, index) => (
                      <motion.div
                        key={clinic.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card
                          className="p-6 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-lg group"
                          onClick={() => handleClinicSelect(clinic)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                              <Building2 className="h-7 w-7 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                {clinic.clinic_name}
                              </h3>
                              <div className="flex items-start gap-1 text-muted-foreground text-sm">
                                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>{clinic.address}, {clinic.city} - {clinic.pincode}</span>
                              </div>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 2: Select Doctor */}
            {step === 2 && selectedClinic && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Selected Hospital</p>
                      <p className="font-semibold">{selectedClinic.clinic_name}</p>
                    </div>
                  </div>
                </Card>

                <p className="text-muted-foreground text-center">
                  Choose a doctor to view their complete profile
                </p>

                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading doctors...</p>
                  </div>
                ) : doctors.length === 0 ? (
                  <Card className="p-8 text-center">
                    <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No doctors available at this hospital</p>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {doctors.map((doctor, index) => (
                      <motion.div
                        key={doctor.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card
                          className="p-6 cursor-pointer hover:border-primary transition-all duration-300 hover:shadow-lg group overflow-hidden"
                          onClick={() => handleDoctorSelect(doctor)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-8 w-8 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors truncate">
                                {doctor.profiles.full_name}
                              </h3>
                              <Badge variant="secondary" className="mb-2">
                                {doctor.specialization}
                              </Badge>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {doctor.experience_years} yrs
                                </span>
                                <span className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 text-yellow-500" />
                                  4.8
                                </span>
                              </div>
                              <p className="text-lg font-bold text-primary">
                                ₹{doctor.consultation_fee}
                              </p>
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Doctor Profile */}
            {step === 3 && selectedDoctor && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="overflow-hidden">
                  {/* Doctor Header */}
                  <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                      <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                        <User className="h-16 w-16 text-primary-foreground" />
                      </div>
                      <div className="text-center md:text-left flex-1">
                        <h2 className="text-3xl font-bold mb-2">{selectedDoctor.profiles.full_name}</h2>
                        <Badge className="mb-4 text-sm px-3 py-1">{selectedDoctor.specialization}</Badge>
                        <div className="flex flex-wrap justify-center md:justify-start gap-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            <span>{selectedDoctor.experience_years} Years Experience</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Star className="h-5 w-5 text-yellow-500" />
                            <span>4.8 Rating</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-sm text-muted-foreground mb-1">Consultation Fee</p>
                        <p className="text-4xl font-bold text-primary">₹{selectedDoctor.consultation_fee}</p>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Details */}
                  <div className="p-8 space-y-6">
                    {/* Education */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <GraduationCap className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Education & Qualifications</h3>
                      </div>
                      <p className="text-muted-foreground pl-7">
                        {selectedDoctor.education || "MBBS, MD - General Medicine"}
                      </p>
                    </div>

                    {/* About */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Stethoscope className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">About</h3>
                      </div>
                      <p className="text-muted-foreground pl-7 leading-relaxed">
                        {selectedDoctor.bio || "Experienced healthcare professional dedicated to providing quality patient care."}
                      </p>
                    </div>

                    {/* Hospital */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Hospital</h3>
                      </div>
                      <div className="pl-7">
                        <p className="font-medium">{selectedClinic?.clinic_name}</p>
                        <p className="text-muted-foreground text-sm">
                          {selectedClinic?.address}, {selectedClinic?.city} - {selectedClinic?.pincode}
                        </p>
                      </div>
                    </div>

                    {/* Timings */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Available Timings</h3>
                      </div>
                      <div className="pl-7 grid grid-cols-2 md:grid-cols-3 gap-2">
                        <Badge variant="outline" className="justify-center py-2">Mon-Fri: 9AM - 6PM</Badge>
                        <Badge variant="outline" className="justify-center py-2">Sat: 9AM - 2PM</Badge>
                        <Badge variant="outline" className="justify-center py-2">Sun: Closed</Badge>
                      </div>
                    </div>
                  </div>
                </Card>

                <Button onClick={handleBookDoctor} size="lg" className="w-full">
                  Book Appointment with {selectedDoctor.profiles.full_name}
                </Button>
              </motion.div>
            )}

            {/* Step 4: Select Time Slot */}
            {step === 4 && selectedDoctor && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="p-4 bg-primary/5 border-primary/20">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Selected Doctor</p>
                      <p className="font-semibold">{selectedDoctor.profiles.full_name} - {selectedDoctor.specialization}</p>
                    </div>
                  </div>
                </Card>
                
                <div>
                  <Label htmlFor="date" className="text-base font-semibold mb-2 block">Select Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-2"
                  />
                </div>

                {selectedDate && (
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Available Time Slots</Label>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                      {timeSlots.map((slot) => (
                        <Button
                          key={slot.time}
                          variant={selectedTime === slot.time ? "default" : "outline"}
                          onClick={() => setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className="h-12"
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Button 
                  onClick={handleTimeSelect} 
                  disabled={!selectedDate || !selectedTime}
                  className="w-full"
                  size="lg"
                >
                  Continue to Patient Details
                </Button>
              </motion.div>
            )}

            {/* Step 5: Patient Details & Payment */}
            {step === 5 && selectedDoctor && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Booking Summary</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Hospital:</strong> {selectedClinic?.clinic_name}</p>
                    <p><strong>Doctor:</strong> {selectedDoctor.profiles.full_name}</p>
                    <p><strong>Specialization:</strong> {selectedDoctor.specialization}</p>
                    <p><strong>Date:</strong> {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p><strong>Time:</strong> {selectedTime}</p>
                    <p className="text-lg font-bold text-primary pt-2 border-t mt-2">
                      Consultation Fee: ₹{selectedDoctor.consultation_fee}
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Patient Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="patientName">Full Name *</Label>
                      <div className="relative mt-2">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="patientName"
                          value={bookingDetails.patientName}
                          onChange={(e) => handleInputChange("patientName", e.target.value)}
                          placeholder="Enter your full name"
                          className={`pl-10 ${validationErrors.patientName ? 'border-destructive' : ''}`}
                          maxLength={100}
                        />
                      </div>
                      {validationErrors.patientName && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.patientName}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="patientEmail">Email Address *</Label>
                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="patientEmail"
                          type="email"
                          value={bookingDetails.patientEmail}
                          onChange={(e) => handleInputChange("patientEmail", e.target.value)}
                          placeholder="your.email@example.com"
                          className={`pl-10 ${validationErrors.patientEmail ? 'border-destructive' : ''}`}
                          maxLength={255}
                        />
                      </div>
                      {validationErrors.patientEmail && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.patientEmail}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="patientPhone">Phone Number *</Label>
                      <div className="relative mt-2">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="patientPhone"
                          type="tel"
                          value={bookingDetails.patientPhone}
                          onChange={(e) => handleInputChange("patientPhone", e.target.value.replace(/\D/g, ''))}
                          placeholder="10-digit mobile number"
                          className={`pl-10 ${validationErrors.patientPhone ? 'border-destructive' : ''}`}
                          maxLength={10}
                        />
                      </div>
                      {validationErrors.patientPhone && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.patientPhone}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="symptoms">Symptoms (Optional)</Label>
                      <Textarea
                        id="symptoms"
                        value={bookingDetails.symptoms}
                        onChange={(e) => handleInputChange("symptoms", e.target.value)}
                        placeholder="Describe your symptoms..."
                        className={`mt-2 ${validationErrors.symptoms ? 'border-destructive' : ''}`}
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {bookingDetails.symptoms.length}/1000 characters
                      </p>
                      {validationErrors.symptoms && (
                        <p className="text-sm text-destructive mt-1">{validationErrors.symptoms}</p>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Payment Method</h3>
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="card" id="card" />
                        <Label htmlFor="card" className="cursor-pointer flex-1">Credit/Debit Card</Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="upi" id="upi" />
                        <Label htmlFor="upi" className="cursor-pointer flex-1">UPI</Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent">
                        <RadioGroupItem value="cash" id="cash" />
                        <Label htmlFor="cash" className="cursor-pointer flex-1">Cash at Hospital</Label>
                      </div>
                    </div>
                  </RadioGroup>
                </Card>

                <Button onClick={handlePayment} disabled={loading} className="w-full" size="lg">
                  <CreditCard className="mr-2 h-5 w-5" />
                  {loading ? "Processing..." : "Confirm Booking & Pay"}
                </Button>
              </motion.div>
            )}

            {/* Step 6: Confirmation */}
            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6"
              >
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="flex justify-center"
                >
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="h-16 w-16 text-primary" />
                  </div>
                </motion.div>
                
                <div>
                  <h2 className="text-3xl font-bold mb-2">Booking Confirmed!</h2>
                  <p className="text-muted-foreground">Your appointment has been successfully booked</p>
                </div>

                <Card className="p-8 max-w-md mx-auto">
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-2">Your Token Number</p>
                    <p className="text-6xl font-bold text-primary">#{tokenNumber}</p>
                  </div>
                  
                  <div className="space-y-3 text-left border-t pt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Patient Name</p>
                      <p className="font-medium">{bookingDetails.patientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Hospital</p>
                      <p className="font-medium">{selectedClinic?.clinic_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Doctor</p>
                      <p className="font-medium">{selectedDoctor?.profiles.full_name}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-medium">{new Date(selectedDate).toLocaleDateString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Time</p>
                        <p className="font-medium">{selectedTime}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Appointment ID</p>
                      <p className="font-medium text-xs break-all">{appointmentId}</p>
                    </div>
                  </div>
                </Card>

                <div className="bg-muted/50 p-4 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground">
                    ⏰ Please arrive <strong>10 minutes</strong> before your appointment time
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    📋 Bring a valid ID and this receipt
                  </p>
                </div>

                <div className="flex gap-4 justify-center flex-wrap">
                  <Button onClick={downloadReceipt} variant="outline" size="lg">
                    <Download className="mr-2 h-4 w-4" />
                    Download Receipt
                  </Button>
                  <Button onClick={() => navigate("/")} size="lg">
                    Back to Home
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicBooking;
