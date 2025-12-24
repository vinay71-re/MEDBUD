import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MapPin, Stethoscope, Calendar as CalendarIcon, CreditCard, CheckCircle, Download, Phone, Mail, User } from "lucide-react";
import Navbar from "@/components/Navbar";
import { z } from "zod";

type Clinic = {
  id: string;
  clinic_name: string;
  address: string;
  city: string;
  doctor_id: string;
};

type Doctor = {
  id: string;
  user_id: string;
  specialization: string;
  consultation_fee: number;
  experience_years: number;
  bio: string;
  education: string;
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
      fetchDoctors(selectedClinic.doctor_id);
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
      .select("*")
      .eq("city", "Vizag");
    
    if (error) {
      toast({ title: "Error loading clinics", variant: "destructive" });
    } else {
      setClinics(data || []);
    }
    setLoading(false);
  };

  const fetchDoctors = async (doctorId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("doctors")
      .select("*, profiles!doctors_user_id_fkey(full_name)")
      .eq("id", doctorId)
      .eq("is_active", true);
    
    if (error) {
      toast({ title: "Error loading doctors", variant: "destructive" });
    } else {
      // Transform the data to handle profiles array from Supabase join
      const transformedData = (data || []).map(doc => ({
        ...doc,
        profiles: Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles || { full_name: 'Unknown Doctor' }
      })) as Doctor[];
      setDoctors(transformedData);
    }
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
    setStep(3);
  };

  const handleTimeSelect = () => {
    if (!selectedDate || !selectedTime) {
      toast({ title: "Please select date and time", variant: "destructive" });
      return;
    }
    setStep(4);
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
      setStep(5);
      toast({ title: "Appointment booked successfully!" });
    } catch (error: any) {
      toast({ title: "Error booking appointment", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof BookingDetails, value: string) => {
    setBookingDetails(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
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

Clinic Details:
--------------
Clinic: ${selectedClinic?.clinic_name}
Address: ${selectedClinic?.address}, ${selectedClinic?.city}

Doctor Details:
--------------
Doctor: ${selectedDoctor?.profiles.full_name}
Specialization: ${selectedDoctor?.specialization}
Education: ${selectedDoctor?.education}
Experience: ${selectedDoctor?.experience_years} years

Appointment Details:
-------------------
Date: ${selectedDate}
Time: ${selectedTime}
Symptoms: ${bookingDetails.symptoms || "N/A"}

Payment Details:
---------------
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {step < 5 && (
            <Button
              variant="ghost"
              onClick={() => step === 1 ? navigate("/") : setStep(step - 1)}
              className="mb-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-smooth ${
                    step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {s}
                  </div>
                  {s < 5 && <div className={`h-1 w-12 mx-2 transition-smooth ${step > s ? "bg-primary" : "bg-muted"}`} />}
                </div>
              ))}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">
                {step === 1 && "Select Hospital"}
                {step === 2 && "Select Doctor"}
                {step === 3 && "Choose Time Slot"}
                {step === 4 && "Patient Details & Payment"}
                {step === 5 && "Booking Confirmed"}
              </h2>
            </div>
          </div>

          {/* Step 1: Select Clinic */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold mb-4">Hospitals in Vizag</h3>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading hospitals...</p>
              ) : clinics.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No hospitals available in Vizag at the moment</p>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {clinics.map((clinic) => (
                    <motion.div
                      key={clinic.id}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className="p-6 cursor-pointer hover:border-primary transition-smooth hover:shadow-medium"
                        onClick={() => handleClinicSelect(clinic)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg mb-1">{clinic.clinic_name}</h3>
                            <p className="text-muted-foreground text-sm">{clinic.address}</p>
                            <p className="text-muted-foreground text-sm">{clinic.city}</p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Doctor */}
          {step === 2 && selectedClinic && (
            <div className="space-y-4">
              <Card className="p-4 bg-muted">
                <p className="text-sm"><strong>Selected Hospital:</strong> {selectedClinic.clinic_name}</p>
              </Card>
              <h3 className="text-xl font-semibold">Available Doctors</h3>
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Loading doctors...</p>
              ) : doctors.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No doctors available at this hospital</p>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {doctors.map((doctor) => (
                    <motion.div
                      key={doctor.id}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className="p-6 cursor-pointer hover:border-primary transition-smooth hover:shadow-medium"
                        onClick={() => handleDoctorSelect(doctor)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{doctor.profiles.full_name}</h3>
                            <p className="text-primary font-medium text-sm mb-2">{doctor.specialization}</p>
                            <p className="text-sm text-muted-foreground mb-1">{doctor.education}</p>
                            <p className="text-sm text-muted-foreground mb-2">{doctor.experience_years} years experience</p>
                            {doctor.bio && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{doctor.bio}</p>}
                            <p className="text-lg font-bold text-primary mt-2">₹{doctor.consultation_fee}</p>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Select Time */}
          {step === 3 && selectedDoctor && (
            <div className="space-y-6">
              <Card className="p-4 bg-muted">
                <p className="text-sm"><strong>Doctor:</strong> {selectedDoctor.profiles.full_name} - {selectedDoctor.specialization}</p>
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
            </div>
          )}

          {/* Step 4: Patient Details & Payment */}
          {step === 4 && selectedDoctor && (
            <div className="space-y-6">
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
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <div className="text-center space-y-6">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="flex justify-center"
              >
                <CheckCircle className="h-24 w-24 text-primary" />
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
                    <p className="font-medium text-xs">{appointmentId}</p>
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
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default PublicBooking;
