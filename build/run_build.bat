call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul
if errorlevel 1 exit /b 1

echo [1/3] Compiling CUDA SM 12.0 (RTX 5090 Blackwell) kernels and core library...
"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\bin\nvcc.exe" -std=c++17 -O3 -arch=sm_120 -Xcompiler "/EHsc /W3 /MD /std:c++17" ^
    -Iinclude ^
    -c src\cuda_kernels.cu -o build\cuda_kernels.obj
if errorlevel 1 exit /b 1

cl.exe /nologo /EHsc /O2 /MD /std:c++17 /Iinclude /I"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\include" ^
    /c src\vk_cuda_interop.cpp src\mls_geometry.cpp src\portrait_prepass.cpp src\phases_3_to_5.cpp ^
    /Fo"build\\"
if errorlevel 1 exit /b 1

echo [2/3] Linking monalisa_test.exe (Phases 0-5 Verification and Benchmark Suite)...
cl.exe /nologo /EHsc /O2 /MD /std:c++17 /Iinclude /I"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\include" ^
    src\test_suite.cpp ^
    build\cuda_kernels.obj build\vk_cuda_interop.obj build\mls_geometry.obj build\portrait_prepass.obj build\phases_3_to_5.obj ^
    /Fe"monalisa_test.exe" /Fo"build\test_suite.obj" ^
    /link /NODEFAULTLIB:LIBCMT /LIBPATH:"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\lib\x64" cudart_static.lib user32.lib gdi32.lib windowscodecs.lib ole32.lib
if errorlevel 1 exit /b 1

echo [3/3] Linking monalisa_app.exe (Interactive Win32 + GPU Studio Desktop App)...
cl.exe /nologo /EHsc /O2 /MD /std:c++17 /Iinclude /I"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\include" ^
    src\win32_app.cpp ^
    build\cuda_kernels.obj build\vk_cuda_interop.obj build\mls_geometry.obj build\portrait_prepass.obj build\phases_3_to_5.obj ^
    /Fe"monalisa_app.exe" /Fo"build\win32_app.obj" ^
    /link /SUBSYSTEM:WINDOWS /ENTRY:mainCRTStartup /NODEFAULTLIB:LIBCMT /LIBPATH:"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v13.2\lib\x64" cudart_static.lib user32.lib gdi32.lib comctl32.lib comdlg32.lib windowscodecs.lib ole32.lib
if errorlevel 1 exit /b 1

echo [SUCCESS] Built monalisa_test.exe and monalisa_app.exe!
