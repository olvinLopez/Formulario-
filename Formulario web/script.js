const ManejadorForm = (function() {
    const CONFIG = {
        formId: 'Formulario',
        btnClass: '.boton',
        paisSelectId: 'pais',
        reglas: {
            nombre: {
                minLen: 2,
                validar: (val) => val.trim().length >= 2,  
                msg: 'El nombre debe tener al menos 2 caracteres.',
                requerido: true
            },
            apellidos: {
                minLen: 2,
                validar: (val) => val.trim().length >= 2,
                msg: 'Los apellidos deben tener al menos 2 caracteres.',
                requerido: true
            },
            cedula: {
                patron: /^[0-9]{10}$/,
                validar: (val) => CONFIG.reglas.cedula.patron.test(val.replace(/\D/g, '')),
                msg: 'La cédula debe tener exactamente 10 dígitos.',
                requerido: true,
                formatear: true  
            },
            fecha: {
                validar: (val) => {
                    if (!val) return false;
                    const nac = new Date(val);
                    const actual = new Date();
                    if (nac > actual) return { ok: false, msg: 'La fecha no puede ser en el futuro.' };
                    const edad = Math.floor((actual - nac) / (365.25 * 24 * 60 * 60 * 1000));
                    if (edad < 18) return { ok: false, msg: `Edad calculada: ${edad} años. Debe ser mayor de 18.` };
                    return { ok: true };
                },
                msg: 'Fecha de nacimiento inválida (debe ser mayor de 18 años).',
                requerido: true
            },
            pais: {
                validar: (val) => val !== '',
                msg: 'Selecciona un país válido.',
                requerido: true
            },
            genero: {
                validar: (val) => val !== '',
                msg: 'Selecciona un género.',
                requerido: true
            },
            telefono: {
                patron: /^[0-9]{10}$/,
                validar: (val) => CONFIG.reglas.telefono.patron.test(val.replace(/\D/g, '')),
                msg: 'El teléfono debe tener 10 dígitos.',
                requerido: true,
                formatear: true 
            },
            correo: {
                patron: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                validar: (val) => CONFIG.reglas.correo.patron.test(val.trim()),
                msg: 'Ingresa un correo electrónico válido.',
                requerido: true
            }
        },
        apiPaises: 'https://restcountries.com/v3.1/all?fields=name',
        timeoutMs: 4500,
        debounceMs: 250
    };

    let formElement, camposList, btnEnvio, timerDebounce, procesandoEnvio = false;
    const erroresMap = new WeakMap();
    const estadosValidos = new WeakMap();  

    function debounceFunc(fn, delay) {
        return (...args) => {
            clearTimeout(timerDebounce);
            timerDebounce = setTimeout(() => fn(...args), delay);
        };
    }

    function setup() {
        formElement = document.getElementById(CONFIG.formId);
        if (!formElement) return;

        camposList = Array.from(formElement.querySelectorAll('.campo'));
        btnEnvio = formElement.querySelector(CONFIG.btnClass);

        generarSpansErrores();
        fetchPaises();
        bindEvents();
        checkBtnState();
    }

    function generarSpansErrores() {
        camposList.forEach(campo => {
            if (campo.tagName === 'SELECT' || campo.type === 'date') return;
            let spanErr = campo.closest('.form-group').querySelector('.error');
            if (!spanErr) {
                spanErr = document.createElement('span');
                spanErr.className = 'error';
                spanErr.id = `err-${campo.id}`;
                spanErr.setAttribute('role', 'alert');
                spanErr.setAttribute('aria-live', 'polite');
                campo.closest('.form-group').appendChild(spanErr);
            }
            erroresMap.set(campo, spanErr);
        });
    }

    async function fetchPaises() {
        const selPais = document.getElementById(CONFIG.paisSelectId);
        if (!selPais || selPais.children.length > 1) return;  

        selPais.disabled = true;
        selPais.innerHTML = '<option value="">Obteniendo países...</option>';

        try {
            const ctrl = new AbortController();
            const toId = setTimeout(() => ctrl.abort(), CONFIG.timeoutMs);

            const resp = await fetch(CONFIG.apiPaises, { signal: ctrl.signal });
            clearTimeout(toId);

            if (!resp.ok) throw new Error(`Respuesta inválida: ${resp.status}`);

            const paisesData = await resp.json();
            const paisesSort = paisesData
                .map(d => d.name.common)
                .filter(name => name)
                .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

            selPais.innerHTML = '<option value="">Elige tu país</option>';
            paisesSort.forEach(paisName => {
                const opt = document.createElement('option');
                opt.value = paisName;
                opt.textContent = paisName;
                selPais.appendChild(opt);
            });

        } catch (err) {
            const paisesBackup = ['Ecuador', 'Colombia', 'Perú', 'Chile', 'Argentina', 'México', 'España', 'Venezuela', 'Bolivia'].sort((a, b) => a.localeCompare(b, 'es'));
            selPais.innerHTML = '<option value="">Países (modo manual)</option>';
            paisesBackup.forEach(paisName => {
                const opt = document.createElement('option');
                opt.value = paisName;
                opt.textContent = paisName;
                selPais.appendChild(opt);
            });
        } finally {
            selPais.disabled = false;
            checkBtnState();
        }
    }

    function bindEvents() {
        formElement.addEventListener('submit', handleSubmit);
        formElement.addEventListener('blur', handleFieldEvent, true);
        formElement.addEventListener('input', debounceFunc(handleFieldEvent, CONFIG.debounceMs), true);
        formElement.addEventListener('change', handleFieldEvent, true);
        formElement.addEventListener('focus', (e) => {
            if (e.target.classList.contains('campo')) {
                clearFieldError(e.target);
                const container = e.target.closest('.campo-container');
                if (container) container.classList.add('has-value');
            }
        }, true);

        camposList.forEach(campo => {
            campo.addEventListener('input', (e) => {
                const container = e.target.closest('.campo-container');
                if (container) container.classList.toggle('has-value', e.target.value.trim() !== '');
            });
            campo.addEventListener('blur', (e) => {
                if (e.target.value.trim() === '') {
                    const container = e.target.closest('.campo-container');
                    if (container) container.classList.remove('has-value');
                }
            });
        });

        const inpCedula = document.getElementById('cedula');
        if (inpCedula) inpCedula.addEventListener('input', (e) => formatCedula(e.target));

        const inpTelefono = document.getElementById('telefono');
        if (inpTelefono) inpTelefono.addEventListener('input', (e) => formatTelefono(e.target));
    }

    function handleFieldEvent(e) {
        const target = e.target;
        if (!target.classList.contains('campo')) return;
        validateField(target);
        checkBtnState();
    }

    function formatCedula(inp) {
        let clean = inp.value.replace(/\D/g, '').slice(0, 10);
        if (clean.length === 10) clean = `${clean.slice(0, 9)}-${clean.slice(9)}`;
        inp.value = clean;
        validateField(inp);
    }

    function formatTelefono(inp) {
        const clean = inp.value.replace(/\D/g, '').slice(0, 10);
        inp.value = clean;
        validateField(inp);
    }

    function validateField(campo) {
        const campoId = campo.id;
        const regla = CONFIG.reglas[campoId];
        if (!regla) return true;

        let valCampo = campo.value;
        if (campoId === 'cedula') valCampo = valCampo.replace(/-/g, '');
        else if (campo.type !== 'date' && campo.tagName !== 'SELECT') valCampo = valCampo.trim();

        if (estadosValidos.has(campo) && estadosValidos.get(campo).valor === valCampo) return estadosValidos.get(campo).valido;

        let resultado = regla.validar(valCampo);
        let msgFinal = regla.msg;
        if (typeof resultado === 'object') {
            if (!resultado.ok) {
                msgFinal = resultado.msg;
                resultado = false;
            } else resultado = true;
        }

        const esValido = !!resultado && (regla.requerido ? valCampo !== '' : true);
        estadosValidos.set(campo, { valido: esValido, valor: valCampo });

        if (esValido) clearFieldError(campo);
        else showFieldError(campo, msgFinal);

        return esValido;
    }

    function showFieldError(campo, msg) {
        const spanErr = erroresMap.get(campo);
        if (spanErr) {
            spanErr.textContent = msg;
            spanErr.classList.add('show');
            campo.setAttribute('aria-invalid', 'true');
            campo.setAttribute('aria-describedby', spanErr.id);
        }
        campo.classList.add('invalid');
        campo.classList.remove('valid');
        const container = campo.closest('.campo-container');
        if (container) container.classList.add('invalid');
    }

    function clearFieldError(campo) {
        const spanErr = erroresMap.get(campo);
        if (spanErr) {
            spanErr.classList.remove('show');
            spanErr.textContent = '';
            campo.removeAttribute('aria-invalid');
            campo.removeAttribute('aria-describedby');
        }
        campo.classList.remove('invalid');
        campo.classList.add('valid');
        const container = campo.closest('.campo-container');
        if (container) container.classList.remove('invalid');
        estadosValidos.delete(campo);
    }

    function checkBtnState() {
        const validoTotal = Object.keys(CONFIG.reglas).every(id => {
            const campo = document.getElementById(id);
            return campo ? validateField(campo) : true;
        });
        btnEnvio.disabled = !validoTotal;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (procesandoEnvio) return;

        procesandoEnvio = true;
        btnEnvio.disabled = true;
        btnEnvio.textContent = 'Enviando datos...';

        let esValido = true;
        Object.keys(CONFIG.reglas).forEach(id => {
            const campo = document.getElementById(id);
            if (campo && !validateField(campo)) esValido = false;
        });

        if (esValido) {
            const formData = new FormData(formElement);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const datosObj = Object.fromEntries(formData);
            showSuccess(datosObj);
            resetForm();
        }

        procesandoEnvio = false;
        btnEnvio.disabled = false;
        btnEnvio.textContent = 'Registrarse';
        checkBtnState();
    }

    function showSuccess(datos) {
        const msgExito = Object.entries(datos)
            .filter(([k]) => CONFIG.reglas[k])
            .map(([k, v]) => {
                const label = k.charAt(0).toUpperCase() + k.slice(1).replace(/([A-Z])/g, ' $1');
                return `${label}: ${v}`;
            })
            .join('\n');
        alert(`¡Registro completado!\n\n${msgExito}`);
        console.log('Datos procesados:', datos);
    }

    function resetForm() {
        formElement.reset();
        camposList.forEach(campo => {
            clearFieldError(campo);
            campo.classList.remove('valid', 'invalid');
            const container = campo.closest('.campo-container');
            if (container) container.classList.remove('has-value');
        });
        estadosValidos.clear();
        checkBtnState();
    }

    return { iniciar: setup };
})();

document.addEventListener('DOMContentLoaded', () => {
    ManejadorForm.iniciar();
});
