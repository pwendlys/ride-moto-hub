import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bike, Users, Shield, MapPin, Star, Clock } from "lucide-react";
import heroImage from "@/assets/hero-mototaxi.jpg";

const Index = () => {
  const [userType, setUserType] = useState<"passenger" | "driver" | null>(null);

  const features = [
    {
      icon: <MapPin className="w-8 h-8" />,
      title: "Rotas Inteligentes",
      description: "GPS integrado com as melhores rotas da cidade"
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Chegada Rápida",
      description: "Tempo médio de espera de apenas 5 minutos"
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Viagem Segura",
      description: "Motoristas verificados e segurados"
    },
    {
      icon: <Star className="w-8 h-8" />,
      title: "Avaliações",
      description: "Sistema de avaliação para garantir qualidade"
    }
  ];

  const stats = [
    { number: "10k+", label: "Corridas Realizadas" },
    { number: "500+", label: "Motoristas Ativos" },
    { number: "4.8★", label: "Avaliação Média" },
    { number: "24/7", label: "Disponibilidade" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent" />
        </div>
        
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-2xl">
            <Badge className="mb-4 bg-gradient-primary text-primary-foreground">
              <Bike className="w-4 h-4 mr-2" />
              Transporte Rápido e Seguro
            </Badge>
            
            <h1 className="text-4xl lg:text-6xl font-bold mb-6 bg-gradient-hero bg-clip-text text-transparent">
              Sua Moto
              <br />
              a um Toque
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-lg">
              Conectamos você aos melhores mototaxistas da cidade. 
              Transporte rápido, seguro e confiável 24 horas por dia.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="hero" 
                size="lg"
                onClick={() => setUserType("passenger")}
                className="text-lg px-8 py-6"
              >
                <Users className="w-5 h-5 mr-2" />
                Sou Passageiro
              </Button>
              
              <Button 
                variant="gradient" 
                size="lg"
                onClick={() => setUserType("driver")}
                className="text-lg px-8 py-6"
              >
                <Bike className="w-5 h-5 mr-2" />
                Sou Mototaxista
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">
                  {stat.number}
                </div>
                <div className="text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Por que escolher nosso app?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Oferecemos a melhor experiência em transporte urbano
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-glow transition-all duration-300">
                <CardHeader>
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Como funciona
            </h2>
          </div>

          <Tabs defaultValue="passenger" className="max-w-4xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="passenger" className="text-lg py-3">
                <Users className="w-5 h-5 mr-2" />
                Para Passageiros
              </TabsTrigger>
              <TabsTrigger value="driver" className="text-lg py-3">
                <Bike className="w-5 h-5 mr-2" />
                Para Mototaxistas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="passenger">
              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                      1
                    </div>
                    <CardTitle>Solicite</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>
                      Informe origem e destino no mapa
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                      2
                    </div>
                    <CardTitle>Conecte</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>
                      Um mototaxista aceita sua corrida
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                      3
                    </div>
                    <CardTitle>Viaje</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>
                      Chegue ao destino com segurança
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="driver">
              <div className="grid md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                      1
                    </div>
                    <CardTitle>Cadastre-se</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>
                      Complete seu perfil e aguarde aprovação
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                      2
                    </div>
                    <CardTitle>Aceite</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>
                      Receba notificações de corridas próximas
                    </CardDescription>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold text-xl">
                      3
                    </div>
                    <CardTitle>Ganhe</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <CardDescription>
                      Receba pagamentos com transparência
                    </CardDescription>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="max-w-4xl mx-auto text-center bg-gradient-hero border-0">
            <CardContent className="py-12">
              <h2 className="text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
                Pronto para começar?
              </h2>
              <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
                Junte-se a milhares de usuários que já escolheram nossa plataforma
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  variant="secondary" 
                  size="lg"
                  className="text-lg px-8 py-6"
                >
                  Começar Agora
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  className="text-lg px-8 py-6 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Saiba Mais
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 sm:mb-0">
              <Bike className="w-6 h-6 text-primary" />
              <span className="font-bold text-xl">MotoHub</span>
            </div>
            
            <p className="text-muted-foreground text-center">
              © 2024 MotoHub. Transporte seguro e confiável.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;