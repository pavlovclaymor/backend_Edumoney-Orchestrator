import mongoose from 'mongoose'; //importe i o mongoose
import dotenv from 'dotenv'; //importei o dotenv da bib dotenv
dotenv.config();

const connectDB = async () => {
  //aqui eu crio uma arrow function asyncrona para conectar o projecto ao banco local da minha maquina
  try {
    await mongoose.connect(process.env.MONGO_URI); // aqui uso o await para esperar essa requisicao ser concluida e so depois passar para o passo seguinte
    console.log('MongoDB connected successfully'); //aqui mostr uma mensagem ao console
  } catch (error) {
    //aqui caso a tentativa falhe ele mostrara o erro.
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
