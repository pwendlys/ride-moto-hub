import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Bike, User, Mail, Phone, Lock, FileText, Car } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [userType, setUserType] = useState<"passenger" | "driver" | "admin">("passenger");
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  
  // Driver specific fields
  const [cnh, setCnh] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleType, setVehicleType] = useState<"motorcycle" | "car">("motorcycle");

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }

    // Detectar parâmetros da URL para pré-selecionar tipo de usuário e modo
    const typeParam = searchParams.get('type');
    const modeParam = searchParams.get('mode');
    
    if (typeParam && ['passenger', 'driver', 'admin'].includes(typeParam)) {
      setUserType(typeParam as "passenger" | "driver" | "admin");
    }
    
    if (modeParam === 'signup') {
      setIsSignUp(true);
    }
  }, [user, navigate, searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const userData = {
          user_type: userType,
          full_name: fullName,
          phone: phone,
          ...(userType === "driver" && {
            cnh,
            vehicle_brand: vehicleBrand,
            vehicle_model: vehicleModel,
            vehicle_plate: vehiclePlate,
            vehicle_color: vehicleColor,
            vehicle_type: vehicleType,
          })
        };

        const { error } = await signUp(email, password, userData);
        
        if (error) {
          throw error;
        }
        
        toast({
          title: "Conta criada com sucesso!",
          description: userType === "driver" 
            ? "Seu cadastro será analisado em até 24 horas." 
            : "Bem-vindo ao MotoHub!",
        });
        
        navigate("/dashboard");
      } else {
        const { error } = await signIn(email, password);
        
        if (error) {
          throw error;
        }
        
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo de volta!",
        });
        
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      {/* Header */}
      <div className="fixed top-0 right-0 z-50 p-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bike className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold">MotoHub</span>
          </div>
          <CardTitle className="text-2xl">
            {isSignUp ? "Criar Conta" : "Entrar"}
          </CardTitle>
          <CardDescription>
            {isSignUp 
              ? "Cadastre-se para começar a usar o MotoHub" 
              : "Entre na sua conta do MotoHub"
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={isSignUp ? "signup" : "signin"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger 
                value="signin" 
                onClick={() => setIsSignUp(false)}
              >
                Entrar
              </TabsTrigger>
              <TabsTrigger 
                value="signup" 
                onClick={() => setIsSignUp(true)}
              >
                Cadastrar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  variant="hero"
                >
                  {isLoading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Usuário</Label>
                  <Select value={userType} onValueChange={(value: "passenger" | "driver" | "admin") => setUserType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passenger">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Passageiro
                        </div>
                      </SelectItem>
                      <SelectItem value="driver">
                        <div className="flex items-center gap-2">
                          <Bike className="w-4 h-4" />
                          Mototaxista
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Administrador
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        placeholder="Seu nome completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                </div>

                {userType === "driver" && (
                  <div className="space-y-4 border-t pt-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      Dados do Veículo
                    </h3>

                    <div className="space-y-2">
                      <Label htmlFor="cnh">CNH</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="cnh"
                          placeholder="Número da CNH"
                          value={cnh}
                          onChange={(e) => setCnh(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehicleBrand">Marca</Label>
                        <Input
                          id="vehicleBrand"
                          placeholder="Honda, Yamaha, etc."
                          value={vehicleBrand}
                          onChange={(e) => setVehicleBrand(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vehicleModel">Modelo</Label>
                        <Input
                          id="vehicleModel"
                          placeholder="CG 160, Factor, etc."
                          value={vehicleModel}
                          onChange={(e) => setVehicleModel(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="vehiclePlate">Placa</Label>
                        <Input
                          id="vehiclePlate"
                          placeholder="ABC-1234"
                          value={vehiclePlate}
                          onChange={(e) => setVehiclePlate(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="vehicleColor">Cor</Label>
                        <Input
                          id="vehicleColor"
                          placeholder="Preto, Branco, etc."
                          value={vehicleColor}
                          onChange={(e) => setVehicleColor(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={vehicleType} onValueChange={(value: "motorcycle" | "car") => setVehicleType(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="motorcycle">Moto</SelectItem>
                            <SelectItem value="car">Carro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  variant="hero"
                >
                  {isLoading ? "Criando conta..." : "Criar Conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              onClick={() => navigate("/")}
              className="text-sm"
            >
              Voltar para página inicial
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;