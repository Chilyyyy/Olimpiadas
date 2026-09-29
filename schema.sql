CREATE TABLE public."user" (
  id bigint NOT NULL,
  nombre text NOT NULL DEFAULT ''::text,
  apellido text NOT NULL DEFAULT ''::text,
  email text NOT NULL DEFAULT ''::text,
  clave text NOT NULL,
  CONSTRAINT user_pkey PRIMARY KEY (id)
);

CREATE TABLE public."Productos" (
  id_producto bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  codigo text NOT NULL UNIQUE,
  nombre text,
  tipo text,
  precio numeric,
  CONSTRAINT Productos_pkey PRIMARY KEY (id_producto)
);

CREATE TABLE public.pedido (
  id_pedido bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  fecha timestamp with time zone NOT NULL DEFAULT now(),
  estado boolean NOT NULL,
  id_usuario bigint NOT NULL,
  CONSTRAINT pedido_pkey PRIMARY KEY (id_pedido),
  CONSTRAINT pedido_id_usuario_fkey
    FOREIGN KEY (id_usuario)
    REFERENCES public."user"(id)
);

CREATE TABLE public.ventas (
  id_venta bigint NOT NULL,
  numero_pedido bigint NOT NULL,
  fecha_venta bigint,
  total bigint,
  CONSTRAINT ventas_pkey PRIMARY KEY (id_venta),
  CONSTRAINT ventas_numero_pedido_fkey
    FOREIGN KEY (numero_pedido)
    REFERENCES public.pedido(id_pedido)
);

CREATE TABLE public.detalles (
  id_detalles bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  numero_pedido bigint NOT NULL,
  id_producto bigint,
  cantidad bigint,
  precio numeric,
  CONSTRAINT detalles_pkey PRIMARY KEY (id_detalles),
  CONSTRAINT detalles_numero_pedido_fkey
    FOREIGN KEY (numero_pedido)
    REFERENCES public.pedido(id_pedido),
  CONSTRAINT detalles_id_producto_fkey
    FOREIGN KEY (id_producto)
    REFERENCES public."Productos"(id_producto)
);