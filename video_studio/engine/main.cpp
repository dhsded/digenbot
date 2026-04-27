#include <napi.h>
#include <iostream>

// Função simples para testar a comunicação entre Node e C++
Napi::String TestEngine(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::cout << "[C++ Engine] Motor de video iniciado com sucesso!" << std::endl;
    return Napi::String::New(env, "Motor C++ conectado! Pronto para editar videos.");
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "testEngine"),
                Napi::Function::New(env, TestEngine));
    return exports;
}

NODE_API_MODULE(video_engine, Init)
